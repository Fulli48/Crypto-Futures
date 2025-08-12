Set-Location "C:\Users\RadDo\Crypto-Futures"
mkdir -Force logs | Out-Null
$env:DATABASE_URL = "postgres://postgres:Fullisyth1@localhost:5432/crypto_futures"
$env:NODE_OPTIONS = "--trace-uncaught --trace-warnings --unhandled-rejections=strict"
$env:DEBUG="*"
npm run dev 2>&1 | Tee-Object -FilePath .\logs\server-latest.log
Read-Host "Press ENTER to close"
