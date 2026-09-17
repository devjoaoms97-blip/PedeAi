@echo off
echo ============================================
echo  Instalando dependencias do sistema...
echo  (isso baixa uns arquivos da internet, so precisa rodar 1 vez)
echo ============================================
cd /d "%~dp0"
call npm install
echo.
echo ============================================
echo  Pronto! Agora pode fechar esta janela e
echo  usar o arquivo "iniciar.bat" para ligar o sistema.
echo ============================================
pause
