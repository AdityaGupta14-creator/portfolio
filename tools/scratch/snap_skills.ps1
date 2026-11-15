$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$outDir = 'C:\Users\Aditya\.gemini\antigravity\brain\a306fb42-30e4-4a57-ab52-6c07de2a4521'
$outPath = Join-Path $outDir 'screenshot_street_peds_skills.png'

$args = @(
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    '--virtual-time-budget=6000',
    "--screenshot=$outPath",
    'http://localhost:5173/?noloading=1&p=0.44'
)
Start-Process -FilePath $chrome -ArgumentList $args -Wait
Copy-Item $outPath -Destination 'c:\Users\Aditya\Desktop\portfolio\screenshots\screenshot_street_peds_skills.png' -Force
Get-Item $outPath | Select-Object Name, Length
