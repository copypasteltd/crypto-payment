$ErrorActionPreference = "Stop"

$targetPath = $env:TARGET_PATH
$outputsPath = $env:OUTPUTS_PATH

if ([string]::IsNullOrWhiteSpace($targetPath)) {
  Write-Error "TARGET_PATH is required"
  exit 1
}

$promptReceived = $false
$completed = $false
$promptLineCount = 0

function Write-Utf8File {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Content
  )

  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Ensure-BaseFiles {
  $reportPath = Join-Path $targetPath "output\\report.txt"
  Write-Utf8File -Path $reportPath -Content "system smoke report`n"
  Write-Output "fake-codex: report prepared"
}

function Emit-CompletionArtifacts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$UserText
  )

  $notePath = Join-Path $targetPath "notes\\from-user.txt"
  Write-Utf8File -Path $notePath -Content "$UserText`n"

  if (-not [string]::IsNullOrWhiteSpace($outputsPath)) {
    $artifactPath = Join-Path $outputsPath "artifact-note.txt"
    Write-Utf8File -Path $artifactPath -Content "artifact from local-process smoke`n"
  }

  Write-Output "fake-codex: user message consumed -> $UserText"
}

function Finish-Successfully {
  if ($completed) {
    return
  }

  $script:completed = $true
  Write-Output "fake-codex: completed"
  Start-Sleep -Milliseconds 300
  exit 0
}

Write-Output "fake-codex: boot"

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) {
    break
  }

  $text = $line.Trim()
  if ([string]::IsNullOrWhiteSpace($text)) {
    continue
  }

  $script:promptLineCount += 1

  if (-not $promptReceived) {
    $script:promptReceived = $true
    Ensure-BaseFiles
    Write-Output "fake-codex: prompt acknowledged"
    continue
  }

  if ($promptLineCount -le 4) {
    continue
  }

  Emit-CompletionArtifacts -UserText $text
  Finish-Successfully
}

if (-not $completed) {
  exit 0
}
