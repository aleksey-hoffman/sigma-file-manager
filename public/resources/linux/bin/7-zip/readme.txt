7-Zip 21.02 alpha for Linux and macOS
-------------------------------------

7-Zip is a file archiver for Windows/Linux/macOS.

7-Zip Copyright (C) 1999-2021 Igor Pavlov.

The main features of 7-Zip: 

  - High compression ratio in the new 7z format
  - Supported formats:
     - Packing / unpacking: 7z, XZ, BZIP2, GZIP, TAR, ZIP and WIM.
     - Unpacking only: AR, ARJ, Base64, CAB, CHM, CPIO, CramFS, DMG, EXT, FAT, GPT, HFS,
                       IHEX, ISO, LZH, LZMA, MBR, MSI, NSIS, NTFS, QCOW2, RAR, 
                       RPM, SquashFS, UDF, UEFI, VDI, VHD, VMDK, XAR and Z.
  - Fast compression and decompression
  - Strong AES-256 encryption in 7z and ZIP formats

7-Zip is free software distributed under the GNU LGPL (except of some code with another license rules).
Read License.txt for more information about license.

This distribution package contains the following files:

  7zz         - standalone console version of 7-Zip
  readme.txt  - this file
  License.txt - license information
  History.txt - History of 7-Zip
  MANUAL      - User's Manual in HTML format


7-Zip and p7zip
===============
Now there are two different ports of 7-Zip for Linux/macOS:

1) p7zip - another port of 7-Zip for Linux, made by an independent developer.
   The latest version of p7zip now is 16.02, and that p7zip 16.02 is outdated now.

2) 7-Zip for Linux/macOS - this package - it's new code with all changes from latest 7-Zip for Windows.

These two ports are not identical. 
Note also that some Linux specific things can be implemented better in p7zip than in new 7-Zip for Linux.


There are several main executables in 7-Zip and p7zip:
    
    7zz (7-Zip) - standalone full version of 7-Zip that supports all formats. 

    7z  (p7zip) - 7-Zip that requires 7z.so shared library, and it supports all formats via 7z.so.
    
    7zr (p7zip) - standalone reduced version of 7-Zip that supports some 7-Zip's formats:
                  7z, xz, lzma and split.
    
    7za (p7zip) - standalone version of 7-Zip that supports some main formats: 
                  7z, xz, lzma, zip, bzip2, gzip, tar, cab, ppmd and split.

The command line syntax for executables from p7zip is similar to 7zz syntax from this package.

The manual of 7-Zip and p7zip can show `7z` in command examples. 
But you can use `7zz`, `7zr`, `7za` instead of `7z` from examples.


Example commands
================

Note: 7-Zip supports filename wildcards in commands.
You must use the quotes for filenames, if you want to use 7-Zip parser for wildcards 
instead of the parser of system shell.

To create zip archive from all *.txt files in current directory:
  ./7zz a archive.zip "*.txt"

To list the contents of archive:
  ./7zz l archive.zip

To list the contents of archive with detailed technical information for each file:
  ./7zz l archive.zip -slt

To extract archive to current directory:
  ./7zz x archive.zip

To test archive and show the log for each file:
  ./7zz t archive.zip -bb

The benchmark command to test the performance of CPU with 7-Zip's LZMA code:
  ./7zz b

The benchmark command to test the performance of CPU with different compression, encryption 
and hash methods from 7-Zip and with different number of threads:
  ./7zz b "-mm=*" "-mmt=*"

---
End of document
