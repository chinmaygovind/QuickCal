@echo off
REM QuickCal Chrome Extension Packaging Script
REM This script automatically packages the extension for distribution

setlocal EnableDelayedExpansion

echo ============================================
echo QuickCal Chrome Extension Package Builder
echo ============================================
echo.

REM Get current date and time for version naming
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "datestamp=%YYYY%_%MM%_%DD%_%HH%%Min%%Sec%"
set "timestamp=%HH%%Min%%Sec%"

# Define package name
set "PACKAGE_NAME=QuickCal_%datestamp%"
set "PACKAGE_DIR=packages"

echo Building package: %PACKAGE_NAME%
echo Date: %MM%/%DD%/%YYYY% %HH%:%Min%:%Sec%
echo.

REM Create packages directory if it doesn't exist
if not exist "%PACKAGE_DIR%" (
    echo Creating packages directory...
    mkdir "%PACKAGE_DIR%"
)

REM Create final package directory
set "FINAL_DIR=%PACKAGE_DIR%\%PACKAGE_NAME%"
if exist "%FINAL_DIR%" (
    echo Cleaning up previous build...
    rmdir /s /q "%FINAL_DIR%"
)

REM Create package directory
echo Creating package directory...
mkdir "%FINAL_DIR%"

REM Copy extension files
echo Copying extension files...

REM Core extension files
copy "manifest.json" "%FINAL_DIR%\" >nul
if not exist "%FINAL_DIR%\manifest.json" (
    echo ERROR: manifest.json not found!
    goto :error
)

copy "quickcal.js" "%FINAL_DIR%\" >nul
if not exist "%FINAL_DIR%\quickcal.js" (
    echo ERROR: quickcal.js not found!
    goto :error
)

REM Copy quickcal directory
if exist "quickcal" (
    echo Copying quickcal directory...
    xcopy "quickcal" "%FINAL_DIR%\quickcal" /s /i /q >nul
) else (
    echo ERROR: quickcal directory not found!
    goto :error
)

REM Copy images directory
if exist "images" (
    echo Copying images directory...
    xcopy "images" "%FINAL_DIR%\images" /s /i /q >nul
) else (
    echo ERROR: images directory not found!
    goto :error
)

REM Copy README if it exists
if exist "README.md" (
    echo Copying README.md...
    copy "README.md" "%FINAL_DIR%\" >nul
)

REM Remove files that shouldn't be in the package
echo Cleaning up package contents...

REM Remove test files and development files
if exist "%FINAL_DIR%\quickcal\validate_key.js" (
    del "%FINAL_DIR%\quickcal\validate_key.js" >nul
    echo Removed validate_key.js
)

REM Remove calendar-link source (keep only if needed)
if exist "%FINAL_DIR%\quickcal\calendar-link" (
    rmdir /s /q "%FINAL_DIR%\quickcal\calendar-link" >nul
    echo Removed calendar-link source directory
)

REM Remove setup directory if not needed
if exist "%FINAL_DIR%\quickcal\setup" (
    echo Keeping setup directory for user guidance...
)

echo.
echo Package contents:
dir "%FINAL_DIR%" /b
echo.

REM Package created successfully!
echo SUCCESS: Package created successfully!
echo Location: %CD%\%FINAL_DIR%
echo.

echo Package validation:
if exist "%FINAL_DIR%\manifest.json" echo ✓ manifest.json
if exist "%FINAL_DIR%\quickcal.js" echo ✓ quickcal.js  
if exist "%FINAL_DIR%\quickcal\popup.html" echo ✓ popup.html
if exist "%FINAL_DIR%\quickcal\init.js" echo ✓ init.js
if exist "%FINAL_DIR%\quickcal\styles.css" echo ✓ styles.css
if exist "%FINAL_DIR%\images\quickcal.png" echo ✓ extension icon

echo.
echo Installation instructions:
echo 1. Open Chrome and go to chrome://extensions/
echo 2. Enable "Developer mode" in the top right
echo 3. Click "Load unpacked" 
echo 4. Select the folder: %FINAL_DIR%
echo.
echo To create a zip file for distribution:
echo 1. Right-click the folder: %FINAL_DIR%
echo 2. Select "Send to > Compressed (zipped) folder"

echo.
echo ============================================
echo Package build completed successfully!
echo ============================================
goto :end

:error
echo.
echo ============================================
echo Package build FAILED!
echo ============================================
echo Please check the error messages above.
if exist "%FINAL_DIR%" (
    echo Cleaning up...
    rmdir /s /q "%FINAL_DIR%"
)
exit /b 1

:end
echo.
pause
exit /b 0
