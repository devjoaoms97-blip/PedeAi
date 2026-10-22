@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Remove-Item -LiteralPath ([Environment]::GetFolderPath('Startup') + '\Sistema de Pedidos.lnk') -ErrorAction SilentlyContinue"
echo O sistema nao vai mais ligar sozinho com o Windows.
echo (Continua funcionando normalmente pelo "iniciar.bat".)
pause
