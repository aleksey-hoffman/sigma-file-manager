param(
  [Parameter(Mandatory = $true)]
  [string]$BundlePath
)

$ErrorActionPreference = "Stop"

function Resolve-MakeAppxPath {
  $onPath = Get-Command makeappx.exe -ErrorAction SilentlyContinue
  if ($onPath) {
    return $onPath.Source
  }

  $candidatePatterns = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe",
    "${env:ProgramFiles}\Windows Kits\10\bin\*\x64\makeappx.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\App Certification Kit\makeappx.exe"
  )

  $candidates = @()
  foreach ($pattern in $candidatePatterns) {
    $candidates += @(Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue)
  }

  $makeappx = $candidates |
    Sort-Object { $_.Directory.Parent.Name } -Descending |
    Select-Object -First 1

  if (-not $makeappx) {
    throw "makeappx.exe was not found. Install the Windows 10 SDK App Packaging Tools, or add makeappx.exe to PATH."
  }

  return $makeappx.FullName
}

$bundle = Resolve-Path $BundlePath
$makeappx = Resolve-MakeAppxPath
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) "sigma-file-manager-msix-$([Guid]::NewGuid())"
$bundleDirectory = Join-Path $temporaryDirectory "bundle"

function Invoke-MakeAppx {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & $makeappx @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "makeappx.exe $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

try {
  New-Item -ItemType Directory -Path $bundleDirectory | Out-Null
  Invoke-MakeAppx -Arguments @("unbundle", "/p", "$bundle", "/d", $bundleDirectory, "/o")

  $packages = @(Get-ChildItem $bundleDirectory -Filter "*.msix")
  if ($packages.Count -eq 0) {
    $packages = @(Get-ChildItem $bundleDirectory -Filter "*.appx")
  }
  if ($packages.Count -eq 0) {
    $bundleContents = Get-ChildItem $bundleDirectory -Recurse -File | ForEach-Object { $_.FullName.Substring($bundleDirectory.Length + 1) }
    throw "The MSIX bundle does not contain architecture packages. Contents: $($bundleContents -join ', ')"
  }

  foreach ($package in $packages) {
    $packageDirectory = Join-Path $temporaryDirectory $package.BaseName
    New-Item -ItemType Directory -Path $packageDirectory | Out-Null
    Invoke-MakeAppx -Arguments @("unpack", "/p", $package.FullName, "/d", $packageDirectory, "/o")

    [xml]$manifest = Get-Content (Join-Path $packageDirectory "AppxManifest.xml") -Raw
    $namespaces = [Xml.XmlNamespaceManager]::new($manifest.NameTable)
    $namespaces.AddNamespace("foundation", "http://schemas.microsoft.com/appx/manifest/foundation/windows10")
    $namespaces.AddNamespace("desktop6", "http://schemas.microsoft.com/appx/manifest/desktop/windows10/6")
    $namespaces.AddNamespace("rescap", "http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities")

    $registryVirtualization = $manifest.SelectSingleNode(
      "/foundation:Package/foundation:Properties/desktop6:RegistryWriteVirtualization",
      $namespaces
    )
    $fileSystemVirtualization = $manifest.SelectSingleNode(
      "/foundation:Package/foundation:Properties/desktop6:FileSystemWriteVirtualization",
      $namespaces
    )
    $unvirtualizedResources = $manifest.SelectSingleNode(
      "/foundation:Package/foundation:Capabilities/rescap:Capability[@Name='unvirtualizedResources']",
      $namespaces
    )
    $targetDeviceFamily = $manifest.SelectSingleNode(
      "/foundation:Package/foundation:Dependencies/foundation:TargetDeviceFamily[@Name='Windows.Desktop']",
      $namespaces
    )

    if ($registryVirtualization.InnerText -ne "disabled") {
      throw "$($package.Name) does not disable registry write virtualization."
    }
    if ($fileSystemVirtualization.InnerText -ne "disabled") {
      throw "$($package.Name) does not disable file system write virtualization."
    }
    if ($null -eq $unvirtualizedResources) {
      throw "$($package.Name) does not declare unvirtualizedResources."
    }
    if ([Version]$targetDeviceFamily.MinVersion -lt [Version]"10.0.18362.0") {
      throw "$($package.Name) targets a Windows version that does not support desktop6 virtualization controls."
    }
  }
}
finally {
  Remove-Item $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
