# CodeSent Scan GitHub Action

This GitHub Action automates **security scanning** of Apigee proxies, shared flows, and mask configurations with **CodeSent**.  
It uploads the selected type, starts the scan (if applicable), waits for completion, and **comments on the pull request** with a link to the results.

## 📌 Features
✅ **Automatically zips and uploads Apigee proxies and shared flows**  
✅ **Uploads mask configuration files**  
✅ **Initiates security scanning for proxies**  
✅ **Waits for the scan to complete**  
✅ **Posts a comment in the pull request** with the scan results  
✅ **Creates a GitHub issue with scan results on push**

---

## 🚀 How to Use?

### **1️⃣ Add to `.github/workflows/codesent_scan.yml`**
Create a GitHub Actions workflow in your repository:

```yaml
name: Scan Apigee API proxy with CodeSent

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Scan with CodeSent
        uses: codesent/codesent-scan-action@v1.0
        with:
          api-key: ${{ secrets.CODESENT_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          upload-type: "proxy" # Options: proxy, sharedflow, mask_config
          mask-file: "mask.xml" # Only required if using mask_config upload-type
```

---

### **2️⃣ Add the API Key to GitHub Secrets**
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add `CODESENT_API_KEY` and paste your **CodeSent API Key**


### **3️⃣ Set Write Workflow Permissions**
1. Navigate to **Settings** → **Actions** → **Workflow permissions**
2. Click **Read and write permissions**

---

## 🔑 Inputs
| Name             | Description                                        | Required |
|-----------------|----------------------------------------------------|:--------:|
| `api-key`       | Your **CodeSent API Key**                          | ✅ Yes   |
| `github-token`  | GitHub Token for commenting on PRs & creating issues | ✅ Yes   |
| `upload-type`   | Type of upload: `proxy`, `sharedflow`, or `mask_config` | ✅ Yes   |
| `proxy-directory` | Path to the Apigee proxy directory (default: `apiproxy`) | ❌ No    |
| `mask-file`     | Path to the mask configuration XML file (only for `mask_config`) | ❌ No    |
| `polling-timeout` | Time in seconds to wait for scan completion (default: 300s) | ❌ No    |

---

## 📋 Example Pull Request Comment
Once the scan completes, a comment like this will appear in the pull request:

```
🔍 **CodeSent Scan Completed**  

**Total Issues** : <Number of issues>
📊 [View Report](https://codesent.io/my/apigee/12345)
```

---

## 🎯 How It Works
1. **Uploads the selected type (proxy, sharedflow, or mask configuration) to CodeSent**
2. **Initiates security scanning (only for proxies)**
3. **Waits for completion**
4. **Posts a comment in the PR with the results**
5. **Creates a GitHub issue with scan results on push**  

---

## 🤔 Why Use This Action?
- 🛡 **Automated security scanning** for Apigee proxies  
- 📂 **Supports uploading sharedflows and mask configurations**  
- 📝 **Seamless integration** into your CI/CD pipeline  
- 🚀 **PR comments ensure visibility** for security results  
- 🔄 **No manual steps required** – just set up once!  

---

## 🛠 Troubleshooting
### ❌ No comment appears in the PR?
- Ensure the workflow **runs on pull requests** (`on: pull_request`)  
- Check that `CODESENT_API_KEY` is **correctly set** in **GitHub Secrets**  

### ❌ Scan fails?
- Make sure your **proxy configuration is valid**  
- Check logs in **GitHub Actions** for error details  

### ❓ Questions
Email to support@codesent.io