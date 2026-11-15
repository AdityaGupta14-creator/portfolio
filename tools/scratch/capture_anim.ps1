$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$outDir = 'C:\Users\Aditya\.gemini\antigravity\brain\a306fb42-30e4-4a57-ab52-6c07de2a4521'
$out1 = Join-Path $outDir 'screenshot_anim_tab1_mixamo.png'
$out2 = Join-Path $outDir 'screenshot_anim_tab2_rigify.png'

$p1 = 'C:\Users\Aditya\AppData\Local\Temp\chrome_anim_tab1'
$p2 = 'C:\Users\Aditya\AppData\Local\Temp\chrome_anim_tab2'

$args1 = @('--headless=new', '--disable-gpu', '--no-sandbox', "--user-data-dir=$p1", '--window-size=1920,1080', '--virtual-time-budget=5000', "--screenshot=$out1", 'http://localhost:5173/debug/anim?tab=mixamo&anim=walk')
Write-Host 'Capturing Tab 1...'
Start-Process -FilePath $chrome -ArgumentList $args1 -Wait

$args2 = @('--headless=new', '--disable-gpu', '--no-sandbox', "--user-data-dir=$p2", '--window-size=1920,1080', '--virtual-time-budget=5000', "--screenshot=$out2", 'http://localhost:5173/debug/anim?tab=rigify')
Write-Host 'Capturing Tab 2...'
Start-Process -FilePath $chrome -ArgumentList $args2 -Wait

Get-Item $out1, $out2 -ErrorAction SilentlyContinue | Select-Object Name, Length
