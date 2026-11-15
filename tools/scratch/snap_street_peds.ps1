$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$outDir = 'C:\Users\Aditya\.gemini\antigravity\brain\a306fb42-30e4-4a57-ab52-6c07de2a4521'

$targets = @(
    @{ Url = 'http://localhost:5173/?noloading=1&p=0.28'; Name = 'screenshot_street_pedestrians.png' },
    @{ Url = 'http://localhost:5173/?noloading=1&focus=0'; Name = 'screenshot_host_building_escort.png' }
)

foreach ($t in $targets) {
    $outPath = Join-Path $outDir $t.Name
    $args = @(
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,720',
        '--virtual-time-budget=6000',
        "--screenshot=$outPath",
        $t.Url
    )
    Start-Process -FilePath $chrome -ArgumentList $args -Wait
    Copy-Item $outPath -Destination (Join-Path 'c:\Users\Aditya\Desktop\portfolio\screenshots' $t.Name) -Force
    Get-Item $outPath | Select-Object Name, Length
}
