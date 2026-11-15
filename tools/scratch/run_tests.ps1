$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$outDir = 'C:\Users\Aditya\.gemini\antigravity\brain\a306fb42-30e4-4a57-ab52-6c07de2a4521'

$tests = @(
    @{ name = 'screenshot_test_sky_hero.png'; url = 'http://localhost:5173/?noloading=1&p=0.0' },
    @{ name = 'screenshot_test_mid_descent.png'; url = 'http://localhost:5173/?noloading=1&p=0.14' },
    @{ name = 'screenshot_test_street_stop101.png'; url = 'http://localhost:5173/?noloading=1&p=0.28' },
    @{ name = 'screenshot_test_hub_destination.png'; url = 'http://localhost:5173/?noloading=1&p=1.0' }
)

foreach ($t in $tests) {
    $outPath = Join-Path $outDir $t.name
    $argList = @(
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1920,1080',
        '--virtual-time-budget=6000',
        "--screenshot=$outPath",
        $t.url
    )
    Write-Host "Capturing $($t.name) from $($t.url)..."
    Start-Process -FilePath $chrome -ArgumentList $argList -Wait
    if (Test-Path $outPath) {
        $item = Get-Item $outPath
        Write-Host "Success: $($item.Name) ($($item.Length) bytes)"
    } else {
        Write-Host "Failed to capture $($t.name)"
    }
}
