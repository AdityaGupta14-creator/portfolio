$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$out = 'C:\Users\Aditya\.gemini\antigravity\brain\a306fb42-30e4-4a57-ab52-6c07de2a4521\screenshot_walk_cycle_test.png'
$args = @(
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    '--virtual-time-budget=4000',
    "--screenshot=$out",
    'http://localhost:5173/debug/assets?tab=walk&pose=stride'
)
Start-Process -FilePath $chrome -ArgumentList $args -Wait
Copy-Item $out -Destination 'c:\Users\Aditya\Desktop\portfolio\screenshots\screenshot_walk_cycle_test.png' -Force
Get-Item $out | Select-Object Name, Length
