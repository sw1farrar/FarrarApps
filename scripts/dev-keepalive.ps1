$ErrorActionPreference = "Continue"
Set-Location "C:\Users\Steve\dev\Projects\FarrarApps"

function Stop-PortListeners([int]$Port) {
  $pids = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $pids) {
    if ($procId -and $procId -ne 0) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Test-DevHealthy {
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 8
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

while ($true) {
  $stamp = Get-Date -Format o
  Write-Host "[$stamp] Starting Next.js on :3000"
  Stop-PortListeners 3000

  $proc = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev","--","-p","3000" -WorkingDirectory "C:\Users\Steve\dev\Projects\FarrarApps" -PassThru -NoNewWindow

  $misses = 0
  $readyWait = 0

  while (-not $proc.HasExited) {
    Start-Sleep -Seconds 10
    $readyWait = $readyWait + 10

    if ($readyWait -lt 20) {
      continue
    }

    if (Test-DevHealthy) {
      $misses = 0
      continue
    }

    $misses = $misses + 1
    $stamp = Get-Date -Format o
    Write-Host "[$stamp] Health check failed ($misses)"
    if ($misses -ge 2) {
      $stamp = Get-Date -Format o
      Write-Host "[$stamp] Dev server hung or crashed - restarting"
      Stop-PortListeners 3000
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
      break
    }
  }

  if ($proc.HasExited) {
    $stamp = Get-Date -Format o
    Write-Host "[$stamp] Dev server exited ($($proc.ExitCode)) - restarting in 2s"
  }

  Start-Sleep -Seconds 2
}
