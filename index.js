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

        console.log(`🔍 Received API Key: ${apiKey ? '✅ Key received' : '❌ Key missing'}`);
        console.log(`🔍 Received GitHub Token: ${githubToken ? '✅ Token received' : '❌ Token missing'}`);

        if (!apiKey) {
            throw new Error("API Key is missing! Make sure 'CODESENT_API_KEY' is set in GitHub Secrets.");
        }

        const headers = { Authorization: `Bearer ${apiKey}` };

        // 📦 Archive the repo
        console.log('📦 Zipping repository...');
        const zipPath = './proxy.zip';
        const zip = new AdmZip();
        zip.addLocalFolder('.');
        zip.writeZip(zipPath);

        // 🚀 Upload ZIP to CodeSent
        console.log('🚀 Uploading ZIP to CodeSent...');
        const formData = new FormData();
        formData.append("file", fs.createReadStream(zipPath));

        const uploadResponse = await axios.post(
            "https://codesent.io/api/scan/v1/upload",
            formData,
            {
                headers: {
                    ...headers, // Authorization остается
                    ...formData.getHeaders(), // Добавляем заголовки для multipart/form-data
                },
            }
        );

        const proxyUuid = uploadResponse.data.proxy_uuid;
        console.log(`✅ Uploaded! Proxy UUID: ${proxyUuid}`);

        // 🔍 Start validation
        console.log('🔍 Starting validation...');
        const validateResponse = await axios.post(`https://codesent.io/api/scan/v1/${proxyUuid}/validate`, null, { headers });

        const taskUuid = validateResponse.data.task_uuid;
        console.log(`✅ Validation started. Task UUID: ${taskUuid}`);

        // 🔄 Poll for scan status
        let status;
        do {
            await new Promise(res => setTimeout(res, 5000));
            const statusResponse = await axios.post(`https://codesent.io/api/scan/v1/${proxyUuid}/${taskUuid}/status`, null, { headers });

            status = statusResponse.data.status;
            console.log(`🔄 Scan status: ${status}`);
        } while (status !== 'done');

        console.log('✅ Scan completed! Fetching results...');

        // 📊 Get scan results
        const resultsResponse = await axios.post(`https://codesent.io/api/scan/v1/${proxyUuid}/${taskUuid}/results`, null, { headers });

        const results = resultsResponse.data;
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
