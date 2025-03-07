const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { HttpClient } = require('@actions/http-client');

async function run() {
    try {
        const apiKey = core.getInput('api-key');
        const githubToken = core.getInput('github-token');

        console.log(`🔍 Received API Key: ${apiKey ? '✅ Key received' : '❌ Key missing'}`);
        console.log(`🔍 Received GitHub Token: ${githubToken ? '✅ Token received' : '❌ Token missing'}`);

        if (!apiKey) {
            throw new Error("API Key is missing! Make sure 'CODESENT_API_KEY' is set in GitHub Secrets.");
        }

        const client = new HttpClient();
        const headers = { Authorization: `Bearer ${apiKey}` };

        // 📦 Archive the repo
        console.log('📦 Zipping repository...');
        const zipPath = './proxy.zip';
        const zip = new AdmZip();
        zip.addLocalFolder('.');
        zip.writeZip(zipPath);

        // 🚀 Upload ZIP to CodeSent
        console.log('🚀 Uploading ZIP to CodeSent...');
        const zipFileStream = fs.createReadStream(zipPath);
        const uploadResponse = await client.post("https://codesent.io/api/scan/v1/upload", zipFileStream, headers);

        if (uploadResponse.message.statusCode !== 200) {
            throw new Error(`Upload failed with status code ${uploadResponse.message.statusCode}`);
        }

        const uploadData = await uploadResponse.readBody();
        const proxyUuid = JSON.parse(uploadData).proxy_uuid;
        console.log(`✅ Uploaded! Proxy UUID: ${proxyUuid}`);

        // 🔍 Start validation
        console.log('🔍 Starting validation...');
        const validateResponse = await client.post(`https://codesent.io/api/scan/v1/${proxyUuid}/validate`, '', headers);

        if (validateResponse.message.statusCode !== 200) {
            throw new Error(`Validation failed with status code ${validateResponse.message.statusCode}`);
        }

        const validateData = await validateResponse.readBody();
        const taskUuid = JSON.parse(validateData).task_uuid;
        console.log(`✅ Validation started. Task UUID: ${taskUuid}`);

        // 🔄 Poll for scan status
        let status;
        do {
            await new Promise(res => setTimeout(res, 5000));
            const statusResponse = await client.post(`https://codesent.io/api/scan/v1/${proxyUuid}/${taskUuid}/status`, '', headers);
            
            if (statusResponse.message.statusCode !== 200) {
                throw new Error(`Status check failed with status code ${statusResponse.message.statusCode}`);
            }

            const statusData = await statusResponse.readBody();
            status = JSON.parse(statusData).status;
            console.log(`🔄 Scan status: ${status}`);
        } while (status !== 'done');

        console.log('✅ Scan completed! Fetching results...');

        // 📊 Get scan results
        const resultsResponse = await client.post(`https://codesent.io/api/scan/v1/${proxyUuid}/${taskUuid}/results`, '', headers);

        if (resultsResponse.message.statusCode !== 200) {
            throw new Error(`Fetching results failed with status code ${resultsResponse.message.statusCode}`);
        }

        const resultsData = await resultsResponse.readBody();
        const results = JSON.parse(resultsData);

        const reportUrl = results.online_report;
        const issueCount = results.issue_count;
        const severityStats = results.severity_stats;

        console.log(`📊 Scan completed. Found ${issueCount} issues.`);

        let severityText = Object.entries(severityStats)
            .map(([severity, count]) => `- **${severity}**: ${count}`)
            .join('\n');

        // 💬 Comment on PR
        const octokit = github.getOctokit(githubToken);
        const { context } = github;

        if (context.payload.pull_request) {
            const prNumber = context.payload.pull_request.number;
            const repo = context.repo.repo;
            const owner = context.repo.owner;

            console.log(`💬 Posting comment to PR #${prNumber}...`);
            await octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: `🔍 **CodeSent Scan Completed**\n\n**Total Issues**: ${issueCount}\n\n**Severity Breakdown:**\n${severityText}\n📊 [View Full Report](${reportUrl})`
            });

            console.log('✅ Comment posted successfully!');
        }
    } catch (error) {
        core.setFailed(`❌ Error: ${error.message}`);
    }
}

run();
