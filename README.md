# 🚀 CodeSent Scan GitHub Action

This GitHub Action automates **security scanning** of Apigee proxies with **CodeSent**.  
It uploads the proxy, starts the scan, waits for completion, and **comments on the pull request** with a link to the results.

## 📌 Features
✅ **Automatically zips the repository**  
✅ **Uploads it to CodeSent**  
✅ **Initiates security scanning**  
✅ **Waits for the scan to complete**  
✅ **Posts a comment in the pull request** with the scan results  

---

## 🚀 How to Use?

### **1️⃣ Add to `.github/workflows/codesent_scan.yml`**
Create a GitHub Actions workflow in your repository:

```yaml
name: Scan API with CodeSent

on:
  pull_request:
    branches:
      - main

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Scan with CodeSent
        uses: codesent/codesent-scan-action@v1
        with:
          api-key: ${{ secrets.CODESENT_API_KEY }}
```

---

### **2️⃣ Add the API Key to GitHub Secrets**
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add `CODESENT_API_KEY` and paste your **CodeSent API Key**

---

## 🔑 Inputs
| Name      | Description                   | Required |
|-----------|-------------------------------|:--------:|
| `api-key` | Your **CodeSent API Key**     | ✅ Yes   |

---

## 📋 Example Pull Request Comment
Once the scan completes, a comment like this will appear in the pull request:

```
🔍 **CodeSent Scan Completed**  
📊 [View Report](https://codesent.io/reports/12345)
```

---

## 🎯 How It Works
1. **Archives the current repository** into a `.zip`
2. **Uploads the archive** to **CodeSent**
3. **Starts the security scan**
4. **Waits for completion**
5. **Posts a comment in the PR** with the results  

---

## 🤔 Why Use This Action?
- 🛡 **Automated security scanning** for Apigee proxies  
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

---

