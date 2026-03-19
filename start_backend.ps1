# 8000 포트 사용 프로세스 종료 후 FastAPI 서버 시작 (예약 API 포함)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$port = 8000
Write-Host "Checking port $port..."
try {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    $pids = $conn.OwningProcess | Sort-Object -Unique | Where-Object { $_ -ne 0 }
    foreach ($p in $pids) {
        Write-Host "Stopping process $p (was using port $port)..."
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
} catch {}
Start-Sleep -Seconds 2

Write-Host "Starting FastAPI server on http://0.0.0.0:$port (with /api/v1/reservations/)..."
python -m uvicorn app.main:app --host 0.0.0.0 --port $port
