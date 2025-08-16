

# 🔒<font color="#757575">IAM Role Anywhere</font>

With the increasing and evolving security threats, how can on-premise servers efficiently and securely communicate with AWS Secrets Manager? Below is the enhanced and structured guide, now detailing how to securely consume AWS Secrets Manager from an on-premise Windows machine using .NET, leveraging IAM Roles Anywhere.

## ✅ **Objective**

Securely access **AWS Secrets Manager** from an **on-premise Windows machine** using **IAM Roles Anywhere**, with a **.NET application** (instead of relying on long-term IAM credentials).

---

## 🔐 **High-Level Architecture**

```
On-Premise Windows Machine (.NET App)
   |
   |---> Signed Certificate (X.509)
   |
   |---> IAM Roles Anywhere (AWS) via aws_signing_helper
   |
   |---> Temporary AWS Credentials (STS)
   |
   |---> .NET SDK uses these to access AWS Secrets Manager
```

---

## 🧱 **Steps to Implement**

### 1. IAM Roles Anywhere – AWS Setup

#### a. **Create an IAM Role**

* Trusted Entity: `IAM Roles Anywhere`
* Attach a permission policy (e.g., `SecretsManagerReadWrite`, or custom policy like):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:<region>:<account>:secret:<secret-name>*"
    }
  ]
}
```

#### b. **Create a Trust Anchor**

* Use **AWS Private CA** or a **trusted self-signed CA**
* Upload the **CA root certificate**

#### c. **Create a Profile**

* Associate the **trust anchor** and **IAM role**

---

### 2. On-Prem Windows Machine – Credential Setup

#### a. **Install aws\_signing\_helper**

* From: [https://github.com/aws/rolesanywhere-credential-helper/releases](https://github.com/aws/rolesanywhere-credential-helper/releases)
* Extract and place in a known location, e.g., `C:\tools\aws-signing-helper`

#### b. **Generate/Obtain Certificates**

* Use your CA to generate:

  * `client-cert.pem`
  * `client-key.pem`
  * `root-ca.pem`

> You may optionally store certs securely using Windows Certificate Store + OpenSSL conversions.

#### c. **Create a local AWS config profile**

Edit `%UserProfile%\.aws\config`:

```ini
[profile rolesanywhere]
credential_process = "C:\\tools\\aws-signing-helper\\aws_signing_helper.exe" credential-process \
--certificate C:\\certs\\client-cert.pem \
--private-key C:\\certs\\client-key.pem \
--trust-anchor-arn arn:aws:rolesanywhere:REGION:ACCOUNT_ID:trust-anchor/TRUST_ANCHOR_ID \
--profile-arn arn:aws:rolesanywhere:REGION:ACCOUNT_ID:profile/PROFILE_ID \
--role-arn arn:aws:iam::ACCOUNT_ID:role/MySecretsRole
```

> ⚠️ Use double backslashes `\\` in Windows paths.

---

## 💻 3. .NET Application – Access SecretsManager

### a. **Install NuGet Packages**

```bash
dotnet add package AWSSDK.SecretsManager
```

>  Ensure `AWSSDK.Core` is also referenced.

---

### b. **Code Sample (.NET 6 or later)**

```csharp
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;

var secretName = "my-app-db-secret";
var region = Amazon.RegionEndpoint.USEast1; // replace as needed

// Use the "rolesanywhere" profile from ~/.aws/config
var awsOptions = new AmazonSecretsManagerConfig
{
    RegionEndpoint = region
};

var credentials = new Amazon.Runtime.StoredProfileAWSCredentials("rolesanywhere");

using var client = new AmazonSecretsManagerClient(credentials, awsOptions);

try
{
    var response = await client.GetSecretValueAsync(new GetSecretValueRequest
    {
        SecretId = secretName
    });

    string secretString = response.SecretString;
    Console.WriteLine($"Retrieved secret: {secretString}");
}
catch (Exception ex)
{
    Console.WriteLine($"Failed to retrieve secret: {ex.Message}");
}
```

---

## ✅ Behavior Summary

* .NET SDK uses the profile-based `StoredProfileAWSCredentials`
* Credential helper (`aws_signing_helper`) runs in background to fetch temporary STS credentials
* AWS Secrets Manager is accessed **securely with no static keys**

---

## 🛡️ Security Best Practices

* Use **least privilege** for IAM role
* Use **secure storage** for client certs (Windows Cert Store or encrypted disk)
* Rotate certs regularly
* Monitor usage with AWS CloudTrail
* Optionally integrate with **AWS Systems Manager Parameter Store** if you need fine-grained config access

---

## 📌 Final Summary

| Component                   | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| IAM Role                    | Defines permissions to access AWS Secrets Manager    |
| IAM Roles Anywhere          | Enables X.509-based secure identity from on-premises |
| aws\_signing\_helper        | Fetches temporary credentials using certificates     |
| AWS SDK for .NET            | Access AWS services using standard credential chain  |
| StoredProfileAWSCredentials | Loads the rolesanywhere credential process profile   |

---

Below is a **step-by-step automation guide** for securely accessing **AWS Secrets Manager** from an **on-premise Windows machine** using **IAM Roles Anywhere**, with **PowerShell scripts** to automate key parts of the setup.

---

## ✅ Steps to Execute the Automation Guide.

Automate the configuration of:

1. Installing the AWS Signing Helper
2. Configuring certificates
3. Creating AWS CLI profiles
4. Using temporary credentials in a .NET app to access Secrets Manager

---

## 🧱 Prerequisites

| Requirement                    | Description                                           |
| ------------------------------ | ----------------------------------------------------- |
| IAM Roles Anywhere set up      | IAM Role, Trust Anchor, and Profile created in AWS    |
| Client cert/key + root CA cert | Exported `.pem` files for certificate and private key |
| PowerShell 5.1 or later        | Installed on the Windows machine                      |
| .NET 6 or later                | Required for running your application                 |

---

## 📁 Folder Structure

Assume the following folder:

```text
C:\aws-rolesanywhere\
│
├── certs\
│   ├── client-cert.pem
│   ├── client-key.pem
│   └── root-ca.pem
│
├── aws-signing-helper\
│   └── aws_signing_helper.exe
```

Update paths as needed.

---

## ⚙️ Step-by-Step with PowerShell Scripts

---

### ✅ Step 1: Configure AWS CLI Profile with Signing Helper

```powershell
$profileName = "rolesanywhere"
$trustAnchorArn = "arn:aws:rolesanywhere:<region>:<account-id>:trust-anchor/<trust-anchor-id>"
$profileArn = "arn:aws:rolesanywhere:<region>:<account-id>:profile/<profile-id>"
$roleArn = "arn:aws:iam::<account-id>:role/<role-name>"

$awsConfigPath = "$env:USERPROFILE\.aws\config"

$helperPath = "C:\\aws-rolesanywhere\\aws-signing-helper\\aws_signing_helper.exe"
$certPath = "C:\\aws-rolesanywhere\\certs\\client-cert.pem"
$keyPath = "C:\\aws-rolesanywhere\\certs\\client-key.pem"

# Ensure .aws folder exists
if (!(Test-Path -Path "$env:USERPROFILE\.aws")) {
    New-Item -Path "$env:USERPROFILE\.aws" -ItemType Directory
}

# Append to config file
$credentialProcessLine = "credential_process = `"$helperPath`" credential-process --certificate `"$certPath`" --private-key `"$keyPath`" --trust-anchor-arn $trustAnchorArn --profile-arn $profileArn --role-arn $roleArn"

@"
[profile $profileName]
region = us-east-1
$credentialProcessLine
"@ | Out-File -FilePath $awsConfigPath -Append -Encoding UTF8

Write-Host "AWS CLI profile '$profileName' configured successfully."
```

---

### ✅ Step 2: Test Credential Retrieval

```powershell
$env:AWS_PROFILE = "rolesanywhere"

aws sts get-caller-identity
```

Expected output: a valid IAM identity based on the IAM role.

---

### ✅ Step 3: PowerShell Script to Retrieve Secret Value

```powershell
param (
    [string]$SecretName = "my-app-secret",
    [string]$Region = "us-east-1"
)

$env:AWS_PROFILE = "rolesanywhere"

$secret = aws secretsmanager get-secret-value `
    --secret-id $SecretName `
    --region $Region `
    --query SecretString `
    --output text

Write-Host "Secret Value:"
Write-Host $secret
```

Save this as `Get-Secret.ps1` and run it after setting up the profile.

---

### ✅ Step 4: Automate .NET App Config (Optional)

If your .NET app uses `appsettings.json`, you can inject the secret like this:

```powershell
$secretValue = & ".\Get-Secret.ps1" -SecretName "my-app-secret"
$jsonPath = "C:\myapp\appsettings.Development.json"

# Assume your JSON has a field "ConnectionStrings:DbSecret"
(Get-Content $jsonPath -Raw) `
    -replace '"DbSecret"\s*:\s*".*?"', '"DbSecret": "' + $secretValue + '"' |
    Set-Content $jsonPath

Write-Host "Injected secret into appsettings.Development.json"
```

---

## 🧪 Optional: Automate Everything with One Script

Here's a simplified one-shot script template:

```powershell
# Combine Setup & Test
.\Configure-RolesAnywhere.ps1
.\Get-Secret.ps1 -SecretName "my-app-secret"
```

Schedule via **Task Scheduler** or a **startup script** if needed.

---

## 🛡️ Security Recommendations

* Use NTFS permissions to protect the `certs` folder
* Rotate certificates periodically
* Use encrypted volumes for sensitive files
* Monitor usage with AWS CloudTrail

---

## ✅ Summary

| Task                                | PowerShell Script/Command                           |
| ----------------------------------- | --------------------------------------------------- |
| Configure AWS CLI Profile           | `Configure-RolesAnywhere.ps1`                       |
| Retrieve Secret from AWS SecretsMgr | `Get-Secret.ps1`                                    |
| Use in .NET app (optional)          | Script to modify `appsettings.json` or env variable |
| Test Identity                       | `aws sts get-caller-identity`                       |

---

Below is the complete [package to dowonload](/aws_rolesanywhere_automation.zip) and work you can unzip the `.zip` file which contains  all scripts and templates.

