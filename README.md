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

## 🚀 **How to Use?**

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
