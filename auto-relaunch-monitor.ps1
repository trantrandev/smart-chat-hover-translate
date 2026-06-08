$ErrorActionPreference = "SilentlyContinue"

$mutexCreated = $false
$mutex = New-Object System.Threading.Mutex($false, "Local\SmartChatHoverTranslateAutoRelaunch", [ref]$mutexCreated)
if (-not $mutexCreated) {
  exit 0
}

$Port = if ($env:AG_ENVI_DEBUG_PORT) { [int]$env:AG_ENVI_DEBUG_PORT } else { 9333 }
$LogFile = Join-Path $env:TEMP "ag-envi-hover-auto-relaunch.log"
$RequestFile = if ($env:AG_ENVI_RELAUNCH_REQUEST_FILE) {
  $env:AG_ENVI_RELAUNCH_REQUEST_FILE
} else {
  Join-Path $env:TEMP "ag-envi-hover-relaunch-request"
}
$StartupGraceSeconds = if ($env:AG_ENVI_STARTUP_GRACE_SECONDS) { [int]$env:AG_ENVI_STARTUP_GRACE_SECONDS } else { 12 }
$RequireExtension = if ($env:AG_ENVI_REQUIRE_EXTENSION) { $env:AG_ENVI_REQUIRE_EXTENSION } else { "1" }

function Write-Log($Message) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $LogFile -Value "[$stamp] $Message"
}

function Test-DebugPort {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-ExtensionInstalled {
  if ($RequireExtension -ne "1") { return $true }
  $manifest = Join-Path $env:USERPROFILE ".antigravity-ide\extensions\extensions.json"
  if (-not (Test-Path $manifest)) { return $false }
  try {
    return (Get-Content $manifest -Raw).Contains('"id":"trantrandev.smart-chat-hover-translate"')
  } catch {
    return $false
  }
}

function Get-AntigravityProcesses {
  Get-Process | Where-Object {
    $_.ProcessName -like "*Antigravity*" -or $_.ProcessName -like "*antigravity*"
  }
}

function Test-AntigravityRunning {
  return @(Get-AntigravityProcesses).Count -gt 0
}

function Find-AntigravityExe($RequestedPath) {
  if ($RequestedPath -and (Test-Path $RequestedPath)) {
    return $RequestedPath
  }

  if ($env:AG_ENVI_APP_PATH -and (Test-Path $env:AG_ENVI_APP_PATH)) {
    return $env:AG_ENVI_APP_PATH
  }

  foreach ($process in Get-AntigravityProcesses) {
    try {
      if ($process.Path -and (Test-Path $process.Path)) {
        return $process.Path
      }
    } catch {}
  }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity IDE\Antigravity IDE.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity\Antigravity.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity IDE\Code.exe"),
    (Join-Path $env:ProgramFiles "Antigravity IDE\Antigravity IDE.exe"),
    (Join-Path $env:ProgramFiles "Antigravity\Antigravity.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Antigravity IDE\Antigravity IDE.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Antigravity\Antigravity.exe")
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Stop-Antigravity {
  foreach ($process in Get-AntigravityProcesses) {
    try {
      Stop-Process -Id $process.Id -Force
    } catch {}
  }

  for ($i = 0; $i -lt 100; $i++) {
    if (-not (Test-AntigravityRunning)) { return }
    Start-Sleep -Milliseconds 200
  }
}

function Start-AntigravityWithDebug($ExePath) {
  if (-not $ExePath -or -not (Test-Path $ExePath)) {
    Write-Log "Cannot find Antigravity executable"
    return $false
  }

  Start-Process -FilePath $ExePath -ArgumentList @(
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=$Port"
  )
  Write-Log "Launched Antigravity: $ExePath"
  return $true
}

function Wait-DebugPort {
  for ($i = 0; $i -lt 30; $i++) {
    if (Test-DebugPort) {
      Write-Log "Debug port $Port is up"
      return $true
    }
    Start-Sleep -Seconds 1
  }

  Write-Log "Debug port $Port did not come up"
  return $false
}

function Invoke-Relaunch($Reason, $RequestedPath) {
  $exePath = Find-AntigravityExe $RequestedPath
  Write-Log "Relaunch requested: $Reason"

  if (Test-AntigravityRunning) {
    Stop-Antigravity
  }

  Start-Sleep -Seconds 2
  if (Start-AntigravityWithDebug $exePath) {
    Wait-DebugPort | Out-Null
  }
}

Write-Log "Windows auto relaunch monitor started; port=$Port"

if ($StartupGraceSeconds -gt 0) {
  Write-Log "Waiting ${StartupGraceSeconds}s so the extension can show its restart notice"
  Start-Sleep -Seconds $StartupGraceSeconds
}

while ($true) {
  if (-not (Test-ExtensionInstalled)) {
    Start-Sleep -Seconds 30
    continue
  }

  if (Test-DebugPort) {
    Remove-Item $RequestFile -Force
    Start-Sleep -Seconds 4
    continue
  }

  if (Test-Path $RequestFile) {
    $requestedPath = $null
    try {
      $request = Get-Content $RequestFile -Raw | ConvertFrom-Json
      $requestedPath = $request.executablePath
    } catch {}
    Remove-Item $RequestFile -Force
    Invoke-Relaunch "explicit request file" $requestedPath
    Start-Sleep -Seconds 4
    continue
  }

  Start-Sleep -Seconds 2
}
