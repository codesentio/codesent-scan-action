const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const axios = require('axios');
const FormData = require('form-data');

async function run() {
    try {
        const apiKey = core.getInput('api-key');
        const githubToken = core.getInput('github-token');
        const uploadType = core.getInput('upload-type') || 'proxy';
        
        
        console.log(`🔍 Received API Key: ${apiKey ? '✅ Key received' : '❌ Key missing'}`);
        console.log(`🔍 Received GitHub Token: ${githubToken ? '✅ Token received' : '❌ Token missing'}`);
        
        if (!apiKey) {
            throw new Error("API Key is missing! Make sure 'CODESENT_API_KEY' is set in GitHub Secrets.");
        }
        
        const headers = { Authorization: `Bearer ${apiKey}` };
        
        const branch = github.context.payload.pull_request
                    ? github.context.payload.pull_request.head.ref
                    : github.context.ref.replace("refs/heads/", "");
        
        const commitHash = github.context.sha;
        
        console.log(`🌿 Branch: ${branch}`);
        console.log(`🔗 Commit: ${commitHash}`);

        const defaultBranch = github.context.payload.repository.default_branch;
        const isDefaultBranch = branch === defaultBranch;
        
        if ((uploadType === 'sharedflow' || uploadType === 'mask_config') && !isDefaultBranch) {
            core.setFailed(`❌ ${uploadType} can only be uploaded from the default branch (${defaultBranch}).`);
            return;
        }
        
        if (uploadType === 'mask_config') {
            const maskFile = core.getInput('mask-file') || 'mask.xml';
            if (!fs.existsSync(maskFile)) {
                core.setFailed(`❌ Mask Config file '${maskFile}' not found.`);
                return;
            }
            
            console.log(`🚀 Uploading 'mask_config' from file '${maskFile}'...`);
            
            const xmlString = fs.readFileSync(maskFile, "utf-8");
            const formData = new URLSearchParams();
            formData.append("xml_string", xmlString);
            
            try {
                await axios.post("https://codesent.io/api/scan/v1/mask_config/upload", formData.toString(), {
                    headers: {
                        ...headers,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                });
                
                console.log("✅ Mask Config uploaded successfully.");
            } catch (error) {
                handleApiError(error, "Uploading Mask Config failed");
                return;
            }
            
            return;
        }
        
        if (uploadType === 'sharedflow') {
            console.log('🚀 Uploading SharedFlow to CodeSent...');
            const zipPath = await createZip('.');
            const formData = new FormData();
            formData.append("file", fs.createReadStream(zipPath));
            formData.append("branch", branch);
            formData.append("commit_hash", commitHash);
            formData.append("is_default_branch", isDefaultBranch.toString());
            
            try {
                await axios.post("https://codesent.io/api/scan/v1/sharedflow/upload", formData, {
                    headers: {
                        ...headers,
                        ...formData.getHeaders(),
                    },
                });
                
                console.log("✅ SharedFlow uploaded successfully.");
            } catch (error) {
                handleApiError(error, "Uploading SharedFlow failed");
                return;
            }
            
            return;
        }
        
        const proxyDirectory = core.getInput('proxy-directory') || 'apiproxy';
        if (!fs.existsSync(proxyDirectory)) {
            throw new Error(`Proxy directory '${proxyDirectory}' not found!`);
        }

        // 📦 Archive the proxy directory
        console.log(`📦 Zipping proxy directory '${proxyDirectory}'...`);
        const zipPath = './proxy.zip';
        const zip = new AdmZip();
        zip.addLocalFolder(proxyDirectory);
        zip.writeZip(zipPath);

        // 🚀 Upload ZIP to CodeSent
        console.log('🚀 Uploading ZIP to CodeSent...');
        const formData = new FormData();
        formData.append("file", fs.createReadStream(zipPath));
        formData.append("branch", branch);
        formData.append("commit_hash", commitHash);
        formData.append("is_default_branch", isDefaultBranch.toString());

        let uploadResponse;
        try {
            uploadResponse = await axios.post(
                "https://codesent.io/api/scan/v1/upload",
                formData,
                {
                    headers: {
                        ...headers,
                        ...formData.getHeaders(),
                    },
                }
            );
        } catch (error) {
            handleApiError(error, "Uploading ZIP failed");
            return;
        }

        const proxyUuid = uploadResponse.data.proxy_uuid;
        console.log(`✅ Uploaded! Proxy UUID: ${proxyUuid}`);

        // 🔍 Start validation
        console.log('🔍 Starting validation...');
        let validateResponse;
        try {
            validateResponse = await axios.post(`https://codesent.io/api/scan/v1/${proxyUuid}/validate`, null, { headers });
        } catch (error) {
            handleApiError(error, "Validation failed");
            return;
        }

        const taskUuid = validateResponse.data.task_uuid;
        console.log(`✅ Validation started. Task UUID: ${taskUuid}`);

        // 🔄 Poll for scan status
        let status;
        const pollingTimeout = parseInt(core.getInput('polling-timeout') || "300", 10) * 1000;
        const pollingStartTime = Date.now();

        try {
            do {
                if (Date.now() - pollingStartTime > pollingTimeout) {
                    throw new Error(`Scan timed out after ${pollingTimeout / 1000} seconds.`);
                }

                await new Promise(res => setTimeout(res, 5000));
                const statusResponse = await axios.post(`https://codesent.io/api/scan/v1/${proxyUuid}/${taskUuid}/status`, null, { headers });
                status = statusResponse.data.status;
                console.log(`🔄 Scan status: ${status}`);
                
                if (status === 'failed' || status === 'cancelled') {
                    const reason = statusResponse.data.reason || "No reason provided";
                    core.setFailed(`❌ Scan ${status.toUpperCase()}: ${reason}`);
                    return;
                }
            } while (status !== 'done');
        } catch (error) {
            handleApiError(error, "Polling for scan status failed");
            return;
        }

        console.log('✅ Scan completed! Fetching results...');

        // 📊 Get scan results
        let resultsResponse;
        try {
            resultsResponse = await axios.post(`https://codesent.io/api/scan/v1/${proxyUuid}/${taskUuid}/results`, null, { headers });
        } catch (error) {
            handleApiError(error, "Fetching scan results failed");
            return;
        }

        const results = resultsResponse.data;
        const reportUrl = results.online_report;
        const issueCount = results.issue_count;
        const severityStats = results.severity_stats;

        console.log(`📊 Scan completed. Found ${issueCount} issues.`);
        console.log(`🔗 Report URL: ${reportUrl}`);

        let severityText = Object.entries(severityStats)
            .map(([severity, count]) => `- **${severity}**: ${count}`)
            .join('\n');

        const octokit = github.getOctokit(githubToken);
        const { context } = github;

        // 📝 Define Issue Title (use PR title if available)
        let issueTitle = `🔍 CodeSent Scan Report - ${new Date().toISOString().split('T')[0]}`;
        if (context.payload.pull_request) {
            issueTitle = `🔍 CodeSent Scan Report for PR: "${context.payload.pull_request.title}"`;
        }

        // 📝 Create GitHub Issue if this is a push
        if (context.eventName === 'push') {
            console.log(`📌 Creating GitHub Issue with scan results...`);
            await octokit.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: issueTitle,
                body: `## CodeSent Scan Results\n\n**Branch**: \`${branch}\`\n**Commit**: \`${commitHash}\`\n\n**Total Issues**: ${issueCount}\n\n**Severity Breakdown:**\n${severityText}\n\n📊 [View Full Report](${reportUrl})`,
                labels: ["security"]
            });
            console.log('✅ Issue created successfully!');
        }

        // 💬 Comment on PR if this is a pull request
        if (context.payload.pull_request) {
            const prNumber = context.payload.pull_request.number;
            console.log(`💬 Posting comment to PR #${prNumber}...`);
            await octokit.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: prNumber,
                body: `🔍 **CodeSent Scan Completed**\n\n**Branch**: \`${branch}\`\n**Commit**: \`${commitHash}\`\n\n**Total Issues**: ${issueCount}\n\n**Severity Breakdown:**\n${severityText}\n\n📊 [View Full Report](${reportUrl})`
            });
            console.log('✅ Comment posted successfully!');
        }
    } catch (error) {
        core.setFailed(`❌ Error: ${error.message}`);
    }
}

function handleApiError(error, action) {
    if (error.response) {
        const status = error.response.status;
        const errorMessage = error.response.data?.error || "Unknown API error";
        console.error(`❌ ${action}: API returned ${status} - ${errorMessage}`);
        core.setFailed(`❌ ${action}: API returned ${status} - ${errorMessage}`);
    } else {
        console.error(`❌ ${action}: ${error.message}`);
        core.setFailed(`❌ ${action}: ${error.message}`);
    }
}

run();
