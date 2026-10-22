@echo off
cd /d "%~dp0"
echo ============================================
echo  Configurando o sistema para ligar sozinho
echo  sempre que o Windows iniciar...
echo ============================================

rem Cria um atalho minimizado para o iniciar.bat na pasta "Inicializar" do usuario.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup') + '\Sistema de Pedidos.lnk');" ^
  "$s.TargetPath = '%~dp0iniciar.bat';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Liga o sistema de pedidos por QR Code';" ^
  "$s.Save()"

if %errorlevel%==0 (
  echo.
  echo Pronto! Na proxima vez que o Windows ligar, o sistema
  echo abre sozinho, com a janela minimizada na barra de tarefas.
  echo Para desfazer, use "desativar-inicio-automatico.bat".
) else (
  echo.
  echo Nao foi possivel criar o atalho. Tente executar de novo.
)
pause
