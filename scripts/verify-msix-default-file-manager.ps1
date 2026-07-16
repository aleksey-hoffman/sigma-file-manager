param(
  [Parameter(Mandatory = $true)]
  [string]$BundlePath
)

$ErrorActionPreference = "Stop"
$bundle = Resolve-Path $BundlePath
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) "sigma-file-manager-msix-$([Guid]::NewGuid())"
$bundleDirectory = Join-Path $temporaryDirectory "bundle"

try {
  New-Item -ItemType Directory -Path $bundleDirectory | Out-Null
  & makeappx.exe unpack /p $bundle /d $bundleDirectory /o | Out-Null

  $packages = Get-ChildItem $bundleDirectory -Filter "*.msix"
  if ($packages.Count -eq 0) {
    throw "The MSIX bundle does not contain architecture packages."
  }

  foreach ($package in $packages) {
    $packageDirectory = Join-Path $temporaryDirectory $package.BaseName
    New-Item -ItemType Directory -Path $packageDirectory | Out-Null
    & makeappx.exe unpack /p $package.FullName /d $packageDirectory /o | Out-Null

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
