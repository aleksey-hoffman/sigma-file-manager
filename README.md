<img src="./.github/media/logo-1024x1024.png" width="64px">

# Sigma File Manager

"Sigma File Manager" is a free, open-source, quickly evolving, modern file manager (explorer / finder) app for Windows, MacOS, and Linux.

Designed, developed, and maintained by [Aleksey Hoffman](https://github.com/aleksey-hoffman)

<img src="./.github/media/main.png">

<i>Artwork in the image: [Futuristic Japanese Palanquin by Julien Gauthier](https://www.artstation.com/artwork/EV8Lo4)</i>

# Features

The list of major features in `version 1.0.0`:

#### **FEATURE #1 | SMART GLOBAL SEARCH**

The search system in this app allows you to find any file / directory on your computer in just a few seconds. For example, to find a file called `"2019 - Document Name.txt"`, you can type something like `"documen 2019"` (with typos, wrong case, wrong word order, missing words, missing symbols, and missing file extension) and the app will quickly find it for you (search usually takes ~2 seconds per 100 GB of data).

<!-- [Read more →](https://github.com/aleksey-hoffman/sigma-file-manager/wiki/features) -->

#### **FEATURE #2 | TABS**

Tabs allow you to navigate your directories faster. You can create separate sets of tabs for every workspace and then quickly switch between them with a click or a shortcut: `Alt + [0-9]`. When you re-launch the app, the tabs are restored to the previous state.

#### **FEATURE #3 | WORKSPACES**

Greatly increases your productivity by allowing you to create your own workspaces and quickly switch between them, which is especially useful when you work on multiple projects. Each workspace has its own set of tabs and its own actions. Actions can perform different operations, e.g. open a website, run a script, open a file in a specific program, etc. When you re-launch the app, the workspaces are restored to the previous state.
<br>**Usage example**: create a workspace set called `"Drawing"` with the following properties:
<br>- `Action 1:` open "artstation" website for inspiration
<br>- `Action 2:` open "youtube" tutorial video for references
<br>- `Action 3:` open template file in Photoshop to get started quickly
<br>- `Set default directory:` "/drawing/references"
<br>- `Set workspace tabs:` tab-1: "/drawing/assets/characters" and tab-2: "/drawing/references"
<br>Then, when you need to quickly get back to your "drawing" project, you just switch to that workspace with a single shortcut and you're set.

#### **FEATURE #4 | ADVANCED WIRELESS FILE SHARING**

This feature allows you to wirelessly share a directory or stream any file to your local devices (connected to your network) in 1 click without installing any apps. 

**Note:** make sure to allow the app access to the network in Firewall when prompted.

#### **FEATURE #5 | ADDRESS BAR**

Address bar lets you quickly navigate directories with your keyboard. It autocompletes file names and automatically opens the directories as you type.

#### **FEATURE #6 | ITEM FILTER**

Item filter allows you to quickly filter out items (notes / files / directories) so you don't have to scroll through hundreds of files / notes trying to find the one you need. It supports advanced glob patterns and property prefixes (for specifying exact properties you want to filter).
<br>Examples:
- Type ".pdf" to show only PDF files.
- Type "GB" to show files which size is measured in GB (e.g. big video files).
- Type "2018" to show files that were created / modified in the year 2018.
- Type "render*{001..003}*.png" to show files which name starts with word "render", contains numbers in range 001 - 003 and ends with extension ".png" (e.g. "render 001.png", "render 002.png", "render 003.png").

The filter will match all of the file properties (name, tags, dates, etc). You can specify a specific file property with a prefix (e.g. "name:2018" to only search name property and exclude other file properties).

>**NOTE:** It doesn't use the global search's typo correction algorithm yet. It might be added in the future updates.

#### **FEATURE #7 | ADVANCED FILE DOWNLOADER**

This feature allows you to stream / download any file from the internet just by dragging it (or its link) onto the app.

It supports almost all file types. You can even drag a "base64 image" string of text and the app will download  it as an image file.

It can even download videos. It supports both URLs and direct links:

- To download from URL (currently only YouTube is supported): drag and drop URL of the page onto the app. In the future, [these websites](https://github.com/ytdl-org/youtube-dl/blob/master/docs/supportedsites.md) will also be supported.
- To download from direct link (any website): drag and drop the direct video link onto the app. Direct video link is a link that points directly to the file, e.g. `https://example.com/video.mp4`. If you open a file in a new tab of the browser and it gets displayed, it's a direct link. Protected videos will also have some parameters after the extension, so make sure to select the whole link, including the parameters. Keep in mind, such links don't stay active for long because the parameters have an expiration time.
- You can also download video streams (e.g. `https://example.com/video.ts?sessionid=[ID]&wmsAuthSign=[TOKEN]`) with or without auth tokens / URL timestamps
  <br><img src="./.github/media/morty.png" width="30px" style="display: inline">- Oh, jeez, Rick...ca..can it really do all of this? Ohh man...ah...I...I don't get it Rick, all these tokens and URLs..how does it even work, Rick?
  <br><img src="./.github/media/rick.png" width="34px" style="display: inline">- shut... \*bUuUUrp\* ...shut up, Morty...wh...what, you want me to show you my math, Morty? That's the power of open-source tech... \*bUuUUrp\* ...technology for you, Morty. With open-source you can do anything Morty, anything!

**Warning:** use this feature only to download your own and non-copyrighted files. By downloading copyrighted files from certain services, you might be breaching their terms of service. If you decide to ignore this warning, at least don't over-abuse this feature, show the services you use some love and consider supporting them at least by disabling the ad blocker on their website or even consider buying their premium subscriptions to support both the service and the content creators on it. Why? Well, because we shouldn't abuse the services that give us free education / entertainment / communities / creative freedom and other great things.

#### **FEATURE #8 | SMART DRAG & DROP**

The drag & drop feature is still in early development, however I've already implemented the following functionality:

- You can download any file (including videos), just by dragging them (or their link) onto the app.

- Drag files / directories from the system into the app and the other way around to copy / move them.

- Provide a comfortable and logical drag & drop behaviour that actually makes sense:
  - To move / download an item into the current directory, just drag it onto the app and drop anywhere on the full-screen overlay.
  - To move / download an item into a specific directory simply hold `Ctrl` to enter "selective mode" and drop it into whatever directory you want.
  - If you want to copy the item instead of moving it, simply hold `Shift`. This behaviour is always consistent, unlike some other file managers, where sometimes the file is copied and sometimes is moved so you're never sure what's going to happen.
  - If you drop a file into a directory that already has a file with that name, the app will let you resolve the conflict with 1 click: automatically save it with a different name or replace the existing file, unlike some other file managers, that don't let you rename the files easily.

#### **FEATURE #9 | SHORTCUTS**

Most actions within the app can be performed with shortcuts. Even the app itself can be opened / closed with a global (system wide) customizable shortcut. This feature helps you work more efficiently and makes the process more enjoyable (e.g. you can instantly open the app and create a new note with just 1 shortcut).

#### **FEATURE #10 | CUSTOMIZABLE HOME PAGE BANNER**

The home page of the app has a unique, recognizable feature - a customizable media background (banner). You can set a custom image / video or choose one of the built-in ones (kindly provided to my by their artists) and personalize the app to your liking. If you like some of the default artworks, make sure to visit the artists' portfolio and consider supporting their work. You can find the source links by hovering the artworks in the background manager (in the banner menu on the home page) and also on this page below.

#### **FEATURE #11 | NOTES**

Advanced note editor in this app allows you to create featureful notes and store them in one convenient, quickly accessible place. Gere's some of its features:
<br>- All your notes are always 1 click / shortcut away. You can create a new note instantly with just 1 keyboard shortcut, without even opening the app first.
<br>- Note editor provides all the basic formatting functionality. It also supports images, math formulas (Katex), lists, checkboxes, etc.
<br>- Notes can be protected from editing, moved into a group, assigned a color (or a tag) and more.

#### **FEATURE #12 | DASHBOARD**

On the dashboard page, you can see all your pinned, protected, tagged items, and the timeline, which allows you to quickly find previously opened items.

#### **FEATURE #13 | FILE PROTECTION**

Have you ever wanted to lock an important file / directory so that you or any other program couldn't accidentally modify / rename / move / delete it?

This feature allows you to protect any file / directory / note from being modified / renamed / moved / deleted. This feature has 2 modes:

- "Simple mode" protects specific items ONLY from within this app. You will still be able to modify / rename / move / delete your protected items using any other program.

- "Advanced mode" is targeted for advanced users. It protects specific items by removing all their permissions, preventing any modification or deletion by any other program, including the terminal, even if the program has admin permissions. The protection can be removed from within the app or by running a special command in the terminal manually.

#### **FEATURE #14 | INFO PANEL**

Info panel displays useful information about the currently selected file / directory:

- Properties like "size", "path", "symlink path", "permissions", etc. which can be easily copied with `Ctrl + Lclick`;

- File preview for media files: audio, video, images (including animated gifs, apng, webp, and many other formats);

#### **FEATURE #15 | ARCHIVER**

Built-in archver allows you to compress files into archives and extract existing archives. It supports most formats.

#### **FEATURE #16 | AUTO UPDATES**

The app can automatically check for updates. If there's a newer release available, it will let you decide if and when you want to download and install it.

#### **FEATURE #17 | CUSTOMIZABLE, WELL THOUGHT-OUT, MODERN DESIGN**

Most professional design concepts look amazing but completely unusable in real apps. 

This app packs lots of advanced features without sacrificing the customizable, minimalistic, modern design. Even the smallest features of this app are well thought-out, for example:


- A lot of features are accessible in just 1-2 clicks or with shortcuts.
- You can quickly scale the whole interface, making all elements smaller or bigger with a single shortcut.
- The app detects file changes, so all the information you see is always up to date (for example, drive list, drive info, directory info like item count, etc.).
- The app will automatically open when you connect a drive to your computer so you can get to your files immediately.
- All colors are properly contrasted so they never cause eye pain and never result in the "retina burn-in" effect.
- You can protect any file / directory / note from being moved, renamed, or deleted.
- App pages save their state properties like scroll position, so when you go back to it, you don't need to scroll the page all the way back to where it was before.
- Conventions are important. This app follows the best, most logical conventions and standards:
  - All paths are divided with forward slashes `/` to avoid confusion and problems with escaping characters. Windows OS is the only major system that doesn't follow this convention, so this app automatically overwrites this non-standardized behavior and replaces all backward `\\` slashes with forward slashes to follow the conventions;
  - All action buttons are placed in the logical order: actions that logically take you back are on the left (e.g. "back", "cancel", "stop"), and the actions that logically take you forward are on the right (e.g. "ok", "continue", "save");
- and more...

#### **FEATURE #18 | COMMUNITY PARTICIPATION**

Anyone can join this community, participate in the development of this app, and learn in the process. This project in an example of how collaboration of open-source and open-content (art) creators can make such projects possible.

#### **AND MANY MORE FEATURES ARE COMING**

Several more major features / improvements are already in development and will be added in the next updates. I'm planning to keep working on the app and keep updating it once every few days / weeks, adding more and more great features with every update.

# The app background story

Even though I've spent 2800+ hours developing this app, I decided to make it free and open-source. Of course, all creators have to monetize their work somehow, but there are 2 ways to do it:

- One way is to make huge profits by producing some close-sourced overly-copyrighted product, hide it behind paywalls and patents, hinder the app's potential, don't share the acquired experience and knowledge with society, punish people when they use your work (that's how the music and film industry works).

- A better way is to build a much faster evolving project using open-source technologies and let everyone benefit from it. Of course, relying on donations is a less profitable model, but I think it's better when the people who use your work are the ones who determine how much support you receive. This is how we incentivize and motivate creators to improve, to make better, more useful, more enriching products / artworks / software / technologies for others. As history has shown us, when we share our knowledge with each other freely and build upon each other's work (e.g. science), we increase the rate of our technological development, which always improves well-being of everyone as a result. This is why open-source and open-content concepts are so important. Projects like this wouldn't be possible without it.

By creating this app, I also wanted to show every beginner that no project is too big for your skills - all you need to do is just start making it, work hard on it every day, learn in the process, and simply don't stop until your project becomes really good. That's the secret to creating something great.
<br>This app is an example of what dedication can do for you - when I started this project I could barely code, this project demonstrates how in just 2 years of part-time work one developer with a $0 budget can create an app, which in version 1.0 is already starting to compete with apps like MacOS "Finder" and Windows "File Explorer" which has been in development for 24+ years by a trillion dollars worth company's team of many highly paid professional developers and designers each of whom has specialized skills, experience, all the resources, tools, and computing power in the world, including super computers, AI algorithms, neural networks, the ability to employ any specialist in the world, and the enormous amounts of data. And despite not having any of this, you can still make a competitive product, if you just start making it and keep working on it until it becomes better than everything else in the field. THat's how you make something great. But as I said, this is only possible in the world where we build upon each other's work, rather than constantly thinking about being sued for using someone's patented technology.

This is how and why "Sigma file manager" was created. It all started from a simple idea of making a concept design, but it's only thanks to other open-source developers, who also decided to share their work with the world, I was able to turn this idea into a quickly evolving app with great potential from which a lot of people would benefit from. Building something for others also gave me a lot of ideas for more impactful projects, some of which are already in development.

## Milestones

✅ **v1.0.0 (May 25 2021):** publish the app;

✅ **by v1.1.0 (May 27 2021):** add 1 major feature, minor improvements, error fixes;

⬜ **by v1.2.0 (May 29 2021):** add 2 major features, 2+ notable improvements, navigator performance improvements;

⬜ **by v1.3.0 (June 2021):** localize the app to 10+ most popular languages;

⬜ **by v1.4.0 (June 2021):** add 2+ major features and 2+ notable improvements;

⬜ **by v1.5.0 (date TBD):** refactor and rewrite the whole codebase in Vue 3, and fix all known issues;

⬜ ...

⬜ **by v2.0.0 (Oct 2021):** (1/20) Add 20 more new major features

⬜ **End goal:** improve the app to the point of becoming the best file manager and one the most useful productivity apps. This milestone will be considered to be achieved when at least 3 reputable independent sources (reviewers / platforms) decide that the app has achieved all of the following titles:
  - ⬜ (0/3 sources) the best productivity impact;
  - ⬜ (0/3 sources) the best UI design;
  - ⬜ (0/3 sources) the best feature set;
  - ⬜ (0/3 sources) the fastest improvement rate;
  - ⬜ (0/3 sources) the most loved file manager app;
  - ⬜ (0/3 sources) the most intelligent file manager app;
  - ⬜ (0/3 sources) is one of top 3 desktop productivity apps;
  Sources: ...

# Supporters

See the full list of rewards, and join our community on Patreon:

<a target="_blank" href="https://patreon.com/sigma_file_manager">
  <img
    src="./.github/media/patreon_button.png"
    width="164px"
    style="box-shadow: 0px 6px 24px rgb(255, 66, 77, 0.2); margin: 16px 0"
  />
</a>

- Supporters are added to the list from top to bottom. The earlier you start supporting the project, the higher your name will be on the list.
- "3+ months" supporters will have the ⭐ badge displayed next to their name.
- The funding will be used for:
  - Support other open-source and open-content creators (developers, educators, digital artists, etc);
  - Fund the development of this project;
  - Fund the development of my other big research project: advanced tools / algorithms that will help scientists speed up development of new medications and treatments for diseases, reducing the time need to find a new medication from 10 years (current average) to just a few months, and hopefully help humanity get rid of diseases;

## SPONSORS - LEVEL 2
Become the first supporter

## SPONSORS - LEVEL 1
Become the first supporter

## GENEROUS SUPPORTERS
<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.photoancestry.com/" title="Houston Photo Restoration">
          <img width="64px" height="64px" src="https://www.photoancestry.com/images/photo-restoration-houston.png">
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.photoancestry.com/" title="Houston Photo Restoration">Jack Lesley</a>
      </td>
    </tr>
  </tbody>
</table>

## GRATEFUL SUPPORTERS
Become the first supporter

<h4 style="margin: 32px 0px;">
  <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/blob/main/BAKERS.md">See the full list of supporters</a>
</h4>


# Contributors - open-content creators

#### Artworks used in the app

Click on the image to visit the source page.
<br>💗 And if you like their art, consider supporting their work 

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/EV8Lo4">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Futuristic Japanese Palanquin by Julien Gauthier.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/0Xl0OV">
          <img width="128px" height="50px" src="./.github/media/home banner previews/The Legends of Star dust by Ahmed Teilab.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/photo/gray-and-white-wallpaper-1103970/">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Abstract by Johannes Plenio.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/photo/blue-and-red-galaxy-artwork-1629236/">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Abstract painting by Suzy Hazelwood.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/g2L9Ke">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Land before Wi-Fi by Dana Franklin.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://unsplash.com/photos/sO-JmQj95ec">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Canyon by Kevin Lanceplaine.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://pixabay.com/videos/starry-sky-seis-am-schlern-14955">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Starry Sky by Andreas.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/XkP2l">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Discovered planet by Darius Kalinauskas.jpg">
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/EV8Lo4">Julien Gauthier</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/0Xl0OV">Ahmed Teilab</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/photo/gray-and-white-wallpaper-1103970/">Johannes Plenio</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/photo/blue-and-red-galaxy-artwork-1629236/">Suzy Hazelwood</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/g2L9Ke">Dana Franklin</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://unsplash.com/photos/sO-JmQj95ec">Kevin Lanceplaine</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://pixabay.com/videos/starry-sky-seis-am-schlern-14955">Andreas</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/XkP2l">Darius Kalinauskas</a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/video/drone-footage-of-the-waterfalls-and-the-mountain-3785075/">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Dragon's Nest by Klaus Pillon.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/video/drone-footage-of-the-waterfalls-and-the-mountain-3785075/">
          <img width="128px" height="50px" src="./.github/media/home banner previews/The City Before The Wall by Klaus Pillon.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/video/drone-footage-of-the-waterfalls-and-the-mountain-3785075/">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Drone Footage Of The Waterfalls And The Mountain by Taryn Elliott.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/zOxE84">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Environment Explorations by Marcel van Vuuren.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/wgGRX">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Maffei 2 by Vadim Sadovski.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/mD3XvZ">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Out of time by Alena Aenami.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/reodm">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Serenity by Alena Aenami.jpg">
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/lVJXXe">
          <img width="128px" height="50px" src="./.github/media/home banner previews/Wait by Alena Aenami.jpg">
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/KrrA9">Klaus Pillon</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/glyNx">Klaus Pillon</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.pexels.com/video/drone-footage-of-the-waterfalls-and-the-mountain-3785075/">Taryn Elliott</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/zOxE84">Marcel van Vuuren</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/wgGRX">Vadim Sadovski</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/mD3XvZ">Alena Aenami</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/reodm">Alena Aenami</a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.artstation.com/artwork/lVJXXe">Alena Aenami</a>
      </td>
    </tr>
  </tbody>
</table>

# Download

The app is completely free. However if you join our community on Patreon you will get a lot of awesome rewards and support the developer's work.

<a target="_blank" href="https://patreon.com/sigma_file_manager">
  <img
    src="./.github/media/patreon_button.png"
    width="164px"
    style="box-shadow: 0px 6px 24px rgb(255, 66, 77, 0.2); margin-bottom: 16px"
  />
</a>

<table>
  <thead>
    <tr>
      <th>Operating system</th>
      <th>Download link (latest version)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Windows</td>
      <td>
        <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/releases/">
          Sigma_file_manager_v1.0.0_Windows.exe
        </a>
      </td>
    </tr>
    <tr>
      <td>MacOS portable</td>
      <td>
        <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/releases/">
          Sigma_file_manager_v1.0.0_MacOS.pkg
        </a>
      </td>
    </tr>
    <tr>
      <td>Linux (any) portable</td>
      <td>
        <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/releases/">
          Sigma_file_manager_v1.0.0_Linux.AppImage
        </a>
      </td>
    </tr>
    <!-- <tr>
      <td>Linux (Ubuntu)</td>
      <td>
        <a target="_blank" href="https://github.com/d2phap/ImageGlass/releases/latest/download/Sigma_file_manager_v1.0.0_Linux.AppImage">
          Get from Software store (snap store)
        </a>
      </td>
    </tr> -->
    <tr>
      <td>Other releases</td>
      <td>
        <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/releases">
          See all releases
        </a>
      </td>
    </tr>
    <tr>
      <td>Utility for integrating AppImages into the system (launcher, dock)</td>
      <td>
        <a target="_blank" href="https://github.com/TheAssassin/AppImageLauncher">
          AppImageLauncher (for Linux only)
        </a>
      </td>
    </tr>
  </tbody>
</table>

#### ⚡ Requirements:

- **Memory (RAM):** minimum: ~100 MB, average: ~300 MB;
- **Storage:** minimum: ~200 MB;
- **OS:** 64-bit: Windows, MacOS, Linux;

#### ⚠ Warnings:

The app is still in early development (prototyping) stage.

- The app hasn't been thoroughly tested yet. It shouldn't delete or damage any data on your computer by itself, but it's possible, so it's highly recommended to backup (copy) all of your important data to an external backup drive (a drive that's disconnected from the computer most of the time) or to cloud storage before installing and using this app.
- Expect to see some errors and performance issues in the first versions of the app. I will be fixing the problems gradually as they get reported by the users.
- The app has not been optimized yet, RAM usage can spike and go over 1 GB during some operations. So, for now, avoid using the app on low-tier computers (i.e. computers with 4 GB of RAM or less).

#### 💡 Hidden treasures

There's a fun secret hidden somewhere on the homepage of the app. Click around, explore it, see if you can find it. Hint: the ancient one will guide you.

### 💬 Get notified

You can follow me on <a href="https://twitter.com/hoffman_aleksey" target="_blank">Twitter</a> if you want to get updates on this app, hear about my upcoming projects, participate in my future giveaways, or just hear my thoughts on different things.

If you just want to get updates on this project, you can click the "watch" button on top of the page.

# Project links

If you want to see the list of features currently in development, or ask a question, or propose a new feature, or report a problem, here are the links:

- <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/issues/new?template=Feature_request.md">Create new feature request</a>
- <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/issues/new?template=Problem_report.md">Create new problem report</a>
- <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/discussions">Create new discussion</a>
- <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/blob/main/CHANGELOG.md">See changelog (update history)</a>
- <a target="_blank" href="https://github.com/aleksey-hoffman/sigma-file-manager/discussions/31">See improvements in development</a>

# Special thanks

**Open-source projects:**

- **Electron:** Makes it possible to create cross-platform apps for desktop platforms.
- **Vue.js:** A wonderful JS framework that speeds up web development.
- **VSCode:** One of the best code editors that significantly simplifies the development process.
- **Vuetify:** Material components library that speeds up UI development.
- **ytdl-org/youtube-dl:** Allows the app to download videos from a URL link using Python.
- **FFMPEG:** Allows the app to convert and edit audio/video/images and get the media info.
- **7-zip.org and quentinrossetti/node-7z:** Allows the app to work with archives (compress/decompress directories and files).
- **Templarian/MaterialDesign:** Provides beautiful, community created, free icons

# For developers

Developers, feel free to optimize and improve the app. Make sure to create a new issue or a discussion before implementing changes, so we can discuss the changes first.

See [CONTRIBUTING.md](./CONTRIBUTING.md) file for help, if you are new to contributing code.

To open the project on the dev server, run the following commands:

```
cd sigma-file-manager
npm install && npm run electron:serve
```

To build the project for your current platform, run the following commands:

```
npm run electron:build
```

The build can be configured in the `./vue.config.js` file

# License

Sigma file manager is licensed under [GNU GPLv3 or later](./LICENSE.md).

Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
