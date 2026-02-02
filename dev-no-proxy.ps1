# Clear all proxy-related environment variables
$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
$env:http_proxy = ""
$env:https_proxy = ""
$env:ALL_PROXY = ""
$env:all_proxy = ""
$env:NO_PROXY = "localhost,127.0.0.1,::1"
$env:no_proxy = "localhost,127.0.0.1,::1"

Write-Host "Proxy environment variables cleared. Starting dev server..." -ForegroundColor Green

# Verify proxy variables are cleared
$proxyVars = Get-ChildItem env: | Where-Object { $_.Name -match 'proxy' -or $_.Name -match 'PROXY' }
if ($proxyVars | Where-Object { $_.Value -and $_.Name -ne 'NO_PROXY' -and $_.Name -ne 'no_proxy' }) {
    Write-Host "WARNING: Still detected proxy variables:" -ForegroundColor Yellow
    $proxyVars | Format-Table Name, Value -AutoSize
} else {
    Write-Host "SUCCESS: Proxy variables cleared" -ForegroundColor Green
}

# Run development server
npm run dev
