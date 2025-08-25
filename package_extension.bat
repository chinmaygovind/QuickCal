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
set "datestamp=%YYYY%_%MM%_%DD%"
set "timestamp=%HH%%Min%%Sec%"

REM Define package name
set "PACKAGE_NAME=QuickCal_%datestamp%"
set "PACKAGE_DIR=packages"
set "TEMP_DIR=temp_package"

echo Building package: %PACKAGE_NAME%.zip
echo Date: %MM%/%DD%/%YYYY% %HH%:%Min%:%Sec%
echo.

REM Create packages directory if it doesn't exist
if not exist "%PACKAGE_DIR%" (
    echo Creating packages directory...
    mkdir "%PACKAGE_DIR%"
)

REM Clean up any existing temp directory
if exist "%TEMP_DIR%" (
    echo Cleaning up previous build...
    rmdir /s /q "%TEMP_DIR%"
)

REM Create temporary packaging directory
echo Creating temporary package directory...
mkdir "%TEMP_DIR%"

REM Copy extension files
echo Copying extension files...

REM Core extension files
copy "manifest.json" "%TEMP_DIR%\" >nul
if not exist "%TEMP_DIR%\manifest.json" (
    echo ERROR: manifest.json not found!
    goto :error
)

copy "quickcal.js" "%TEMP_DIR%\" >nul
if not exist "%TEMP_DIR%\quickcal.js" (
    echo ERROR: quickcal.js not found!
    goto :error
)

REM Copy quickcal directory
if exist "quickcal" (
    echo Copying quickcal directory...
    xcopy "quickcal" "%TEMP_DIR%\quickcal" /s /i /q >nul
) else (
    echo ERROR: quickcal directory not found!
    goto :error
)

REM Copy images directory
if exist "images" (
    echo Copying images directory...
    xcopy "images" "%TEMP_DIR%\images" /s /i /q >nul
) else (
    echo ERROR: images directory not found!
    goto :error
)

REM Copy README if it exists
if exist "README.md" (
    echo Copying README.md...
    copy "README.md" "%TEMP_DIR%\" >nul
)

REM Remove files that shouldn't be in the package
echo Cleaning up package contents...

REM Remove test files and development files
if exist "%TEMP_DIR%\quickcal\validate_key.js" (
    del "%TEMP_DIR%\quickcal\validate_key.js" >nul
    echo Removed validate_key.js
)

REM Remove calendar-link source (keep only if needed)
if exist "%TEMP_DIR%\quickcal\calendar-link" (
    rmdir /s /q "%TEMP_DIR%\quickcal\calendar-link" >nul
    echo Removed calendar-link source directory
)

REM Remove setup directory if not needed
if exist "%TEMP_DIR%\quickcal\setup" (
    echo Keeping setup directory for user guidance...
)

echo.
echo Package contents:
dir "%TEMP_DIR%" /b
echo.

REM Create the zip file
echo Creating zip package...

REM Try to use PowerShell to create zip (Windows 10+)
powershell -command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%PACKAGE_DIR%\%PACKAGE_NAME%.zip' -Force" >nul 2>&1

if exist "%PACKAGE_DIR%\%PACKAGE_NAME%.zip" (
    echo SUCCESS: Package created successfully!
    echo Location: %CD%\%PACKAGE_DIR%\%PACKAGE_NAME%.zip
    
    REM Get file size
    for %%A in ("%PACKAGE_DIR%\%PACKAGE_NAME%.zip") do (
        set "size=%%~zA"
        set /a "sizeKB=!size!/1024"
        echo Size: !sizeKB! KB
    )
) else (
    echo ERROR: Failed to create zip package!
    echo.
    echo Trying alternative method with 7-Zip...
    
    REM Try 7-Zip if available
    where 7z >nul 2>&1
    if !errorlevel! equ 0 (
        7z a "%PACKAGE_DIR%\%PACKAGE_NAME%.zip" "%TEMP_DIR%\*" >nul
        if exist "%PACKAGE_DIR%\%PACKAGE_NAME%.zip" (
            echo SUCCESS: Package created with 7-Zip!
        ) else (
            echo ERROR: 7-Zip packaging also failed!
            goto :error
        )
    ) else (
        echo ERROR: PowerShell zip failed and 7-Zip not found!
        echo.
        echo Manual packaging required:
        echo 1. Go to %TEMP_DIR% directory
        echo 2. Select all files and folders
        echo 3. Right-click and "Send to > Compressed folder"
        echo 4. Rename to %PACKAGE_NAME%.zip
        echo 5. Move to %PACKAGE_DIR% directory
        goto :error
    )
)

echo.
echo Package validation:
if exist "%TEMP_DIR%\manifest.json" echo ✓ manifest.json
if exist "%TEMP_DIR%\quickcal.js" echo ✓ quickcal.js  
if exist "%TEMP_DIR%\quickcal\popup.html" echo ✓ popup.html
if exist "%TEMP_DIR%\quickcal\init.js" echo ✓ init.js
if exist "%TEMP_DIR%\quickcal\styles.css" echo ✓ styles.css
if exist "%TEMP_DIR%\images\quickcal.png" echo ✓ extension icon

echo.
echo Installation instructions:
echo 1. Open Chrome and go to chrome://extensions/
echo 2. Enable "Developer mode" in the top right
echo 3. Click "Load unpacked" and select the extracted folder
echo    OR
echo 4. Drag and drop the .zip file onto the extensions page

REM Clean up temp directory
echo.
echo Cleaning up temporary files...
rmdir /s /q "%TEMP_DIR%"

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
if exist "%TEMP_DIR%" (
    echo Cleaning up...
    rmdir /s /q "%TEMP_DIR%"
)
exit /b 1

:end
echo.
pause
exit /b 0
