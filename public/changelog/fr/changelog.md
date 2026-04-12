# Journal des modifications

## [2.0.0-beta.3] - April 2026

**Résumé :** Système d'extensions avec marketplace, partage de fichiers en réseau local, menu d'accès rapide, archives zip, lecteurs WSL, édition des étiquettes, amélioration de l'aperçu rapide et de la recherche, améliorations des effets visuels, et de nombreuses améliorations UX et de stabilité.

- [Nouvelles fonctionnalités](#nouvelles-fonctionnalités)
  - [Système d'extensions](#système-dextensions)
  - [Gestionnaire de fichiers par défaut](#gestionnaire-de-fichiers-par-défaut)
  - [Partage en réseau local](#partage-en-réseau-local)
  - [Menu d'accès rapide](#menu-daccès-rapide)
  - [Archives Zip](#archives-zip)
  - [Détection des lecteurs WSL](#détection-des-lecteurs-wsl)
  - [Édition des étiquettes](#édition-des-étiquettes)
  - [Mises à jour intégrées](#mises-à-jour-intégrées)
  - [Copier le chemin](#copier-le-chemin)
  - [Fermer les onglets en double](#fermer-les-onglets-en-double)
  - [Menus contextuels Accueil & Tableau de bord](#menus-contextuels-accueil--tableau-de-bord)
  - [Mode de fusion des effets visuels](#mode-de-fusion-des-effets-visuels)
- [Nouveaux paramètres](#nouveaux-paramètres)
- [Nouveaux raccourcis](#nouveaux-raccourcis)
- [Nouvelles langues](#nouvelles-langues)
- [Améliorations UX](#améliorations-ux)
  - [Améliorations de l'aperçu rapide](#améliorations-de-laperçu-rapide)
  - [Améliorations de la recherche rapide](#améliorations-de-la-recherche-rapide)
  - [Opérations sur les fichiers](#opérations-sur-les-fichiers)
  - [Effets visuels](#effets-visuels)
- [Améliorations de l'interface](#améliorations-de-linterface)
- [Corrections de bugs](#corrections-de-bugs)

### Nouvelles fonctionnalités

#### Système d'extensions

Système d'extensions complet avec marketplace ouvert.

- **Marketplace** : parcourez, installez et gérez les extensions depuis le marketplace ;
- **Installation locale** : vous pouvez installer des extensions depuis un dossier local ;
- **Palette de commandes** : nouvelle façon d'activer les commandes de l'application et des extensions ;
- **Capacités** : les extensions peuvent enregistrer des raccourcis locaux et globaux, des éléments de menu contextuel, des paramètres, des pages entières et des commandes ;
- **Gestion des versions** : vous pouvez installer différentes versions d'extensions et activer la mise à jour automatique ;
- **Localisation** : les extensions peuvent fournir des traductions pour différentes langues ;
- **Gestion des binaires** : les extensions peuvent utiliser des binaires (ffmpeg, deno, node, yt-dlp, 7z, et tout autre binaire existant) ;
- **Exécution isolée** : les extensions s'exécutent dans des sandboxes ESM isolées avec des permissions granulaires ;

#### Gestionnaire de fichiers par défaut

Vous pouvez maintenant définir SFM comme gestionnaire de fichiers par défaut sur Windows (`Paramètres > Expérimental`). Lorsque ce paramètre est activé, la plupart des actions système sur les fichiers seront redirigées vers SFM :

- Icône de l'application Explorateur de fichiers ;
- Raccourci `Ctrl+E` ;
- Révéler le fichier dans le dossier ;
- Afficher les téléchargements (lorsque vous téléchargez un fichier dans le navigateur) ;
- Commandes du terminal : "start {path}", "code {path}", etc.
- Et plus encore ;

Les vues système natives comme la « Corbeille », le « Panneau de configuration » et autres programmes profondément intégrés sont délégués à l'Explorateur de fichiers natif.

#### Partage en réseau local

Partagez et diffusez des fichiers et des répertoires sur votre réseau local directement depuis l'application.

Accédez au partage en réseau local depuis le bouton de la barre d'outils dans le navigateur ou depuis le menu contextuel sur n'importe quel fichier ou répertoire. Lorsqu'un partage est actif, un code QR et des URL partageables sont affichés. Deux modes sont disponibles :

- **Diffusion** : diffusez des fichiers et des répertoires vers n'importe quel appareil de votre réseau via un navigateur web ;
- **FTP** : partagez des fichiers via FTP pour un accès direct depuis d'autres applications. Vous pouvez télécharger et envoyer des fichiers depuis et vers l'ordinateur depuis un autre appareil ;

#### Menu d'accès rapide

Le bouton « Tableau de bord » dans la barre latérale fonctionne désormais comme un menu d'accès rapide. En survolant ce bouton, un panneau s'ouvre affichant vos Favoris et vos éléments Étiquetés.

Tous les éléments du panneau sont de véritables entrées de répertoire — vous pouvez glisser-déposer des éléments vers et depuis le panneau, ouvrir des menus contextuels avec un clic droit, et effectuer toutes les opérations standard sur les fichiers.

Peut être désactivé dans `Paramètres > Apparence de l'interface > Ouvrir le panneau d'accès rapide au survol`.

#### Archives Zip

Compressez et extrayez des archives zip directement depuis le menu d'actions du navigateur de fichiers :

- **Extraire** : extrayez un fichier `.zip` dans le répertoire courant ou dans un dossier nommé ;
- **Compresser** : compressez les fichiers et répertoires sélectionnés en une archive `.zip` ;

#### Détection des lecteurs WSL

Sur Windows, l'application détecte désormais automatiquement les distributions WSL installées et affiche leurs lecteurs dans le navigateur, vous permettant de parcourir les systèmes de fichiers WSL nativement.

#### Édition des étiquettes

Vous pouvez maintenant modifier les noms et les couleurs des étiquettes. Ouvrez le sélecteur d'étiquettes sur n'importe quel fichier ou répertoire pour renommer les étiquettes, changer leur couleur ou les supprimer.

#### Mises à jour intégrées

Vous pouvez maintenant télécharger et installer les mises à jour directement depuis la notification de mise à jour sans quitter l'application.

#### Copier le chemin

Ajout de l'option « Copier le chemin » dans le menu contextuel des fichiers et répertoires.

#### Fermer les onglets en double

Ajout de la possibilité de fermer les onglets en double depuis la barre d'onglets, supprimant tous les onglets pointant vers le même répertoire.

#### Menus contextuels Accueil & Tableau de bord

Les éléments de la page d'accueil et du tableau de bord disposent désormais de menus contextuels complets, offrant les mêmes fonctionnalités que dans le navigateur.

### Nouveaux paramètres

- **Afficher la bannière média de l'accueil** : afficher ou masquer la bannière média de la page d'accueil (`Paramètres > Apparence de l'interface > Bannière média de la page d'accueil`) ;
- **Délai des info-bulles** : configurer le délai avant l'apparition des info-bulles (`Paramètres > Apparence de l'interface > Info-bulles`) ;
- **Temps relatif** : afficher les horodatages récents en format relatif, par ex. « il y a 5 min » (`Paramètres > Général > Date / heure`) ;
- **Format de date et heure** : configurer le format du mois, le format régional, l'horloge 12 heures, les secondes et les millisecondes (`Paramètres > Général > Date / heure`) ;
- **Flou de l'arrière-plan des dialogues** : définir l'intensité du flou pour l'arrière-plan des dialogues (`Paramètres > Apparence de l'interface > Paramètres de style`) ;
- **Filtres de luminosité et de contraste** : ajuster les filtres de style de luminosité et de contraste pour l'interface de l'application (`Paramètres > Apparence de l'interface > Paramètres de style`) ;
- **Luminosité du média en superposition** : ajuster la luminosité du média en superposition des effets visuels (`Paramètres > Apparence de l'interface > Effets visuels`) ;
- **Mode de fusion des effets visuels** : ajuster le mode de fusion pour les effets visuels, vous permettant de choisir comment le média d'arrière-plan se mélange avec l'interface de l'application (`Paramètres > Apparence de l'interface > Effets visuels`) ;
- **Mettre en pause la vidéo d'arrière-plan** : mettre en pause la bannière d'accueil et la vidéo d'arrière-plan lorsque l'application est inactive ou réduite (`Paramètres > Apparence de l'interface > Effets visuels`) ;
- **Gestionnaire de fichiers par défaut** : définir Sigma File Manager comme explorateur de fichiers par défaut sur Windows (`Paramètres > Expérimental`) ;
- **Lancement au démarrage du système** : lancer automatiquement l'application lorsque vous vous connectez à votre système (`Paramètres > Général > Comportement au démarrage`) ;

### Nouveaux raccourcis

- **Copier le chemin du répertoire courant** (`Ctrl+Shift+C`) : copier le chemin du répertoire courant dans le presse-papiers ;
- **Recharger le répertoire courant** (`F5`) : actualiser la liste des fichiers du navigateur ;
- **Zoom avant / arrière** (`Ctrl+=` / `Ctrl+-`) : augmenter ou diminuer le zoom de l'interface ;
- **Plein écran** (`F11`) : basculer en mode plein écran ;

### Nouvelles langues

- **Hindi** ;
- **Ourdou** ;

### Améliorations UX

#### Améliorations de l'aperçu rapide

- **Navigation dans les médias** : naviguez entre les fichiers du répertoire courant sans fermer l'aperçu rapide ;
- **Aperçu des fichiers texte** : aperçu amélioré des fichiers texte avec détection correcte de l'encodage, édition en ligne et rendu du markdown ;

#### Améliorations de la recherche rapide

- **Toutes les propriétés** : recherchez par n'importe quelle propriété de fichier — nom, taille, nombre d'éléments, modifié, créé, accédé, chemin ou type MIME (par ex. `modified: today`, `mime: image`) ;
- **Plages de taille** : filtrez par taille en utilisant des comparaisons et des plages (par ex. `size: >=2mb`, `size: 1mb..10mb`) ;

#### Opérations sur les fichiers

- **Sécurité de résolution des conflits** : amélioration de la sécurité des fichiers dans la fenêtre de résolution des conflits pour prévenir la perte accidentelle de données ;
- **Collage à usage unique** : les éléments copiés ne peuvent être collés qu'une seule fois, empêchant les collages en double accidentels ;
- **Copier le texte** : permet de copier le texte de l'interface avec `Ctrl+C` lorsqu'aucun fichier n'est sélectionné ;

#### Effets visuels

- **Gestionnaire d'arrière-plan** : ajout d'un gestionnaire d'arrière-plan dans la page des paramètres pour une personnalisation centralisée de l'arrière-plan ;
- **Réinitialisation des effets d'arrière-plan** : ajout d'un bouton de réinitialisation pour les paramètres des effets d'arrière-plan ;

#### Autre

- **Réduction de la taille de l'application** : réduction de la taille du bundle en excluant les arrière-plans intégrés haute résolution et en utilisant des aperçus compressés dans l'éditeur de bannière média ;
- **Recherche globale** : affichage d'un bouton « afficher les paramètres » dans l'état vide et augmentation de la profondeur de recherche par défaut ;
- **Raccourcis Windows** : les fichiers `.lnk` ouvrent désormais leur cible dans le navigateur au lieu de les lancer en externe ;
- **Tableau de bord** : amélioration de la disposition de la section étiquetée ;
- **Menu contextuel de la barre d'adresse** : ajout d'un menu contextuel aux éléments de la barre d'adresse ;
- **Menu contextuel du navigateur** : affichage du menu contextuel lors d'un clic sur une zone vide du navigateur ;
- **Ouvrir dans un nouvel onglet** : ouvrir les répertoires dans un nouvel onglet avec un clic du bouton central de la souris ;
- **Défilement des onglets** : les onglets nouvellement ajoutés défilent automatiquement pour être visibles ;
- **Focus des menus** : les menus ne renvoient plus le focus à leur bouton déclencheur lorsqu'ils sont fermés par un clic extérieur ;
- **Fermer la recherche** : fermer la recherche globale avec `Escape` ;
- **Lancement plus rapide** : légère amélioration de la vitesse de lancement de l'application en préchargeant les paramètres en Rust ;
- **Répertoires utilisateur** : ajout de la possibilité d'ajouter et de supprimer des répertoires utilisateur sur la page d'accueil ;
- **Limites des listes** : diminution des limites pour les entrées fréquentes et d'historique afin d'améliorer les performances ;

### Améliorations de l'interface

- **Icônes de la barre d'outils** : uniformisation des couleurs des icônes de la barre d'outils dans l'application ;
- **Animations des cartes** : ajout d'effets de décalage et d'apparition progressive aux cartes ;
- **Thème clair** : amélioration des couleurs et du contraste du thème clair ;
- **Stabilité au lancement** : amélioration de la stabilité visuelle lors du lancement de l'application pour réduire le scintillement ;
- **Notifications** : amélioration du design des notifications pour une meilleure cohérence ;
- **Défilement automatique des onglets** : défilement automatique de l'onglet sélectionné pour le rendre visible lors de l'ouverture de la page du navigateur ;
- **Libellés du chemin racine** : normalisation des libellés du chemin racine dans les onglets et le panneau d'informations ;
- **Traductions** : amélioration des traductions dans l'application ;

### Corrections de bugs

- Correction du gel de l'interface lors de la copie ou du déplacement de nombreux éléments ; ajout de la progression des opérations de fichiers au centre d'état ;
- Correction du gel de l'interface lors de la suppression de nombreux éléments ; ajout de la progression de la suppression au centre d'état ;
- Correction du menu contextuel en vue grille qui ne s'ouvrait pas pour le répertoire courant lorsqu'un autre élément avait déjà un menu ouvert ;
- Correction du panneau d'informations n'affichant pas toutes les informations pour le répertoire courant ;
- Correction des raccourcis de l'application enregistrés sur la fenêtre d'aperçu rapide au lieu de la fenêtre principale uniquement ;
- Correction des fichiers glissés depuis les navigateurs web qui n'étaient pas traités ;
- Correction des noms de fichiers provenant de dépôts d'URL externes ne conservant pas les segments valides ;
- Correction de la bannière d'accueil qui était déplaçable ;
- Correction du cache des icônes système non indexé par chemin de fichier, causant des icônes incorrectes ;
- Correction des entrées racine Windows inaccessibles apparaissant dans le navigateur ;
- Correction des raccourcis personnalisés non identifiés sur certaines dispositions de clavier ;
- Correction des connexions SSHFS sur Linux ;
- Correction de la barre d'adresse créant des entrées d'historique en double lors d'un clic sur le fil d'Ariane ;
- Correction des résultats de la recherche globale ne répondant pas à la navigation au clavier ;
- Correction des résultats de la recherche globale ne s'ouvrant pas au clic ;
- Correction de l'état de la recherche globale ne se synchronisant pas après l'indexation incrémentale ;
- Correction du glisser-déposer sortant ne fonctionnant pas dans certaines applications ;
- Correction du design incohérent des badges de raccourcis dans l'application ;
- Correction de la visibilité des colonnes du navigateur dans les panneaux étroits ;

---

## [2.0.0-beta.2] - February 2026

**Résumé :** Raccourcis globaux, nouveaux paramètres, nouvelles fonctionnalités, filtrage de fichiers amélioré, barre d'adresse améliorée, améliorations de la bannière d'accueil et corrections de bugs.

### Raccourcis globaux

Vous pouvez désormais utiliser des raccourcis clavier pour interagir avec l'application même lorsqu'elle n'est pas au premier plan.

Raccourcis ajoutés :

- `Win+Shift+E` pour afficher et mettre au premier plan la fenêtre de l'application ;

### Nouveaux paramètres

Ajout d'un paramètre pour choisir ce qui se passe lorsque le dernier onglet est fermé.

![Paramètre fermer le dernier onglet](./public/changelog/assets/beta-2/setting-close-last-tab.png)

### Nouvelles fonctionnalités

Ajout de nouvelles fonctionnalités en avant-première :

- Emplacements réseau : permet de connecter un emplacement réseau (SSHFS (SSH) / NFS / SMB / CIFS) ;
- [Linux] Montage de lecteurs : permet de démonter des emplacements ;

### Filtre de fichiers

Le filtre de fichiers a été amélioré :
- Désormais, lorsque vous changez de répertoire, il se vide et se ferme automatiquement ;
- La fonction « filtrer en tapant » s'active dans le panneau sélectionné, pas le premier ;

### Barre d'adresse

- Design amélioré et logique d'auto-complétion ;
- Les séparateurs de chemin sont désormais des menus déroulants qui permettent une navigation rapide vers n'importe quel répertoire parent ;

![Menus des séparateurs](./public/changelog/assets/beta-2/divider-menus.png)

### Bannière d'accueil / Effets d'arrière-plan

- Design amélioré de l'éditeur de bannière média :
  - Le menu des options de la bannière média s'ouvre désormais vers le bas pour éviter d'obstruer la vue ;
  - Vous pouvez maintenant cliquer à l'extérieur pour fermer l'éditeur de position de l'arrière-plan ;
  - Le champ URL déplacé au-dessus des arrière-plans personnalisés ;
- Les images/vidéos personnalisées peuvent être utilisées dans les effets visuels d'arrière-plan ;
- Suppression de certaines images de bannière média par défaut ;
- Ajout d'une nouvelle image de bannière « Exile by Aleksey Hoffman » ;

### Améliorations UX

- L'application restaure la position précédente de la fenêtre au lancement ;
- L'onglet courant peut désormais être fermé avec le raccourci `Ctrl+W` ou un clic du bouton central de la souris ;
- Augmentation de la taille des icônes de fichiers en vue grille ;

### Corrections de bugs

- Correction du déplacement de fichiers entre onglets les déplaçant parfois au mauvais emplacement ;
- Correction du navigateur affichant parfois de mauvaises icônes système pour les répertoires ;
- Correction de la création de plusieurs instances de l'application et de la barre système ;
- Correction du menu des extensions shell récupérant les données périodiquement, ce qui forçait la liste à défiler vers le haut en permanence ;

## [2.0.0-beta.1] - February 2026

**Résumé :** Améliorations majeures d'utilisabilité et de design incluant la navigation au clavier, de nouveaux raccourcis, l'ouverture dans le terminal, l'actualisation automatique des répertoires, le glisser-déposer, et des améliorations de la recherche et des vues en liste.

### Navigation au clavier

Naviguez dans les fichiers à l'aide du clavier avec un support complet pour les dispositions en grille et en liste et la vue divisée.

- Touches fléchées pour la navigation spatiale en vue grille et la navigation séquentielle en vue liste ;
- Entrée pour ouvrir le répertoire ou fichier sélectionné, Retour arrière pour revenir en arrière ;
- Ctrl+Gauche / Ctrl+Droite pour basculer le focus entre les panneaux de la vue divisée ;
- Ctrl+T pour ouvrir le répertoire courant dans un nouvel onglet ;
- Tous les raccourcis de navigation sont personnalisables dans Paramètres > Raccourcis ;

### Actualisation automatique des répertoires

La vue du navigateur s'actualise automatiquement lorsque des fichiers sont créés, supprimés, renommés ou modifiés dans le répertoire courant.

- Les tailles des fichiers se mettent à jour automatiquement lorsqu'elles sont modifiées par des applications externes ;
- Surveillance efficace du système de fichiers avec anti-rebond pour éviter les actualisations excessives ;
- Mises à jour intelligentes basées sur les différences ne modifiant que les éléments affectés, préservant la position de défilement et la sélection ;

### Glisser-déposer

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/beta-1/drag-and-drop.mp4"></video>

Vous pouvez désormais glisser des fichiers et des dossiers pour les copier/déplacer facilement. Glissez entre les panneaux, depuis ou vers les listes de résultats de recherche, depuis ou vers des applications externes.

### Conflits de copie

Ajout d'une fenêtre modale pour une résolution facile des conflits de copie/déplacement.

### Mise à jour automatique

Ajout de la vérification automatique des mises à jour (peut être contrôlée depuis les paramètres).

### Éditeur de média de la bannière d'accueil

Ajout d'un éditeur pour la personnalisation de la bannière de la page d'accueil. Vous pouvez maintenant télécharger des images et vidéos personnalisées (les fichiers locaux et les URL distantes sont supportés)

### Améliorations de la vue en liste

- Design amélioré et correction de petits désagréments ;
- Ajout de la personnalisation de la visibilité des colonnes : choisissez quelles colonnes afficher ;
- Ajout du tri par colonnes : cliquez sur les en-têtes de colonnes pour trier les entrées ;
- La disposition par défaut du navigateur est passée en vue liste ;

### Améliorations de la recherche globale

- Disposition et design mis à jour avec support du glisser-déposer ;
- La recherche est désormais disponible pendant l'indexation des lecteurs ;

### Ouvrir dans le terminal

Ouvrez des répertoires dans votre terminal préféré directement depuis le menu contextuel.

- Détection automatique des terminaux installés sur Windows, macOS et Linux ;
- Windows Terminal affiche tous les profils shell configurés avec les icônes d'exécutables ;
- Le terminal par défaut de Linux est auto-détecté et affiché en premier ;
- Inclut les modes normal et administrateur/élevé ;
- Raccourci par défaut : Alt+T ;

### Localisation

- Ajout de la langue slovène (grâce à : @anderlli0053) ;

### Améliorations UI / UX

- Ajout d'un sélecteur de police : choisissez la police de l'interface parmi les polices système installées ;
- Ajout d'un menu « Créer nouveau » pour créer rapidement des fichiers ou des répertoires ;
- Affichage d'une vue d'état vide lors de la navigation vers des répertoires vides ;
- La barre d'état affiche le nombre total d'éléments avec le nombre masqué lorsque la liste est filtrée ;
- Les éléments nouvellement créés, copiés et déplacés défilent automatiquement pour être visibles ;
- La barre d'outils du presse-papiers affichée une seule fois sous les panneaux au lieu de dans chaque panneau ;
- Design simplifié de la fenêtre de renommage ;
- Icônes de la barre d'outils responsives qui se replient dans un menu déroulant pour les petites fenêtres ;
- Suppression de l'onglet « Navigation » vide des paramètres ;
- Le renommage d'un répertoire met désormais à jour son chemin dans tous les onglets, espaces de travail, favoris, étiquettes, historique et éléments fréquents ;
- La suppression d'un fichier ou répertoire le retire désormais de toutes les listes stockées et redirige les onglets concernés vers l'accueil ;
- Les chemins inexistants dans les favoris, étiquettes, historique et éléments fréquents sont désormais nettoyés automatiquement au démarrage ;

### Corrections de bugs

- Correction de l'état d'indexation de la recherche globale ne se mettant pas à jour en temps réel ;
- Correction du panneau de la vue divisée ne se mettant pas à jour lorsque son répertoire est supprimé ou renommé depuis l'autre panneau ;
- Correction des onglets se chargeant avec une erreur lorsque leur chemin stocké n'existe plus ;
- Correction des icônes système affichant la même icône pour tous les fichiers du même type au lieu d'icônes uniques par fichier ;
- Correction des raccourcis clavier ne fonctionnant pas dans le second panneau de la vue divisée ;
- Correction des raccourcis clavier cessant de fonctionner après la navigation entre les pages ;
- Correction d'une fuite mémoire avec les écouteurs de touche du filtre non nettoyés au démontage ;
- Linux : ajout du support de la récupération de l'application par défaut dans le menu « ouvrir avec » ;

---

## [2.0.0-alpha.6] - January 2026

**Résumé :** Fenêtre Nouveautés, Aperçu rapide, améliorations du menu contextuel et nouveaux paramètres.

### Fenêtre Nouveautés

Une fenêtre de journal des modifications qui affiche les nouvelles fonctionnalités et améliorations pour chaque version.

- Apparaît automatiquement après les mises à jour (peut être désactivé) ;
- Parcourez toutes les versions ;
- Consultez les descriptions détaillées et les captures d'écran pour chaque fonctionnalité ;

### Aperçu rapide

Prévisualisez les fichiers sans les ouvrir complètement grâce à une fenêtre d'aperçu légère.

- Appuyez sur `Espace` ou l'option « Aperçu rapide » dans le menu contextuel pour visualiser rapidement les fichiers ;
- Fermez instantanément avec `Espace` ou `Escape`.
- Supporte les images, vidéos, audio, fichiers texte, PDF et plus encore ;

<video width="100%" mute autoplay loop controls src="./public/changelog/assets/alpha-6/quick-view.mp4"></video>

### Calcul de la taille des répertoires

- La taille des répertoires est désormais calculée automatiquement ;
- Vous pouvez voir la taille totale de tous les répertoires, y compris tous les sous-répertoires et fichiers, dès que vous ouvrez un répertoire ;

![Ouvrir avec](./public/changelog/assets/alpha-6/size.png)

### Nouvelles options du menu contextuel

#### Ouvrir avec

- Choisissez quelle application utiliser pour ouvrir un fichier ;
- Configurez des préréglages personnalisés pour ouvrir des fichiers dans des applications avec des paramètres ;
- Visualisez toutes les applications compatibles pour n'importe quel type de fichier ;
- Définissez des applications par défaut pour des types de fichiers spécifiques ;

![Ouvrir avec](./public/changelog/assets/alpha-6/open-with.png)

#### Extensions shell

- Accédez aux éléments du menu contextuel shell de Windows ;
- Accédez aux extensions shell tierces (7-Zip, Git, etc.) ;

![Extensions shell](./public/changelog/assets/alpha-6/shell-extensions.png)

### Nouveaux paramètres

#### Détection des lecteurs

- Met l'application au premier plan lorsque des lecteurs amovibles sont connectés (peut être désactivé) ;
- Contrôlez le comportement d'ouverture automatique de l'Explorateur Windows pour les lecteurs amovibles ;

#### Filtrer en tapant

Commencez à taper n'importe où dans le navigateur pour filtrer instantanément les éléments du répertoire courant ;

#### Raccourci de recherche des paramètres

Nouveau raccourci clavier pour un accès rapide à la recherche dans les paramètres ;

#### Données statistiques utilisateur

- Ajout d'une section de paramètres statistiques ;
- Sur la page du tableau de bord, vous pouvez voir, naviguer, effacer l'historique, les favoris et les éléments fréquemment utilisés ;

### Améliorations de la recherche

Recherche globale améliorée avec un système hybride indexé + direct pour des résultats plus fiables et à jour.

- Les recherches prennent désormais systématiquement moins d'une seconde (~1 To de lecteur plein), quel que soit l'emplacement des fichiers sur vos lecteurs ;
- Lorsque vous recherchez dans vos « chemins prioritaires » (ceux que vous ouvrez souvent), vous obtenez des résultats instantanément et les fichiers sont trouvés même s'ils viennent d'être créés et n'ont pas encore été indexés.

#### Les chemins prioritaires incluent :
- Répertoires utilisateur : Téléchargements, Documents, Bureau, Images, Vidéos, Musique ;
- Favoris ;
- Récemment ouverts ;
- Fréquemment utilisés ;
- Étiquetés ;

---

## [2.0.0-alpha.5] - January 2026

**Résumé :** Opérations sur les fichiers, recherche globale et personnalisation des raccourcis.

### Recherche globale

Recherche puissante sur tout le disque qui indexe et recherche des fichiers sur tous vos lecteurs. Comprend la correspondance approximative pour trouver des fichiers même avec des fautes de frappe, la ré-indexation automatique périodique, l'indexation prioritaire des répertoires fréquemment utilisés et l'analyse parallèle optionnelle pour une indexation plus rapide.

![Recherche globale](./public/changelog/assets/alpha-5/search.png)

### Opérations sur les fichiers

Support complet des opérations sur les fichiers avec copie, déplacement et suppression incluant le suivi de la progression. Inclut également le renommage de fichiers et dossiers sur place.

### Éditeur de raccourcis

Personnalisez tous les raccourcis clavier de l'application. Visualisez les associations actuelles, détectez les conflits et réinitialisez les valeurs par défaut.

### Améliorations du navigateur

Ajout de l'option d'afficher les icônes système natives pour les fichiers et répertoires au lieu de glyphes minimalistes. Les onglets de navigation des paramètres restent désormais fixés en haut de la page lors du défilement.

---

## [2.0.0-alpha.4] - January 2026

**Résumé :** Page d'accueil, effets visuels et options de personnalisation utilisateur.

### Page d'accueil

Une belle page d'accueil avec une bannière média animée, une liste de lecteurs et un accès rapide aux répertoires utilisateur courants comme Documents, Téléchargements, Images et plus encore.

### Effets visuels

Section d'effets visuels personnalisables dans les paramètres qui ajoute du flou, de l'opacité et des effets de bruit à l'arrière-plan de l'application. Supporte des paramètres différents pour chaque page.

### Éditeur de répertoires utilisateur

Personnalisez vos cartes de répertoires utilisateur avec des titres, icônes et chemins personnalisés. Personnalisez l'apparence de vos répertoires d'accès rapide sur la page d'accueil.

### Éditeur de position de la bannière

Ajustez finement la position de vos arrière-plans de bannière de la page d'accueil. Ajustez le zoom, le positionnement horizontal et vertical pour un rendu parfait.

### Améliorations des paramètres

- La recherche dans les paramètres fonctionne désormais dans toutes les langues, pas seulement la langue courante ;
- L'application restaure le dernier onglet de paramètres visité au rechargement au lieu d'ouvrir le premier à chaque fois ;

---

## [2.0.0-alpha.3] - December 2025

**Résumé :** Vue du navigateur avec onglets, espaces de travail et un nouveau système de design.

### Vue du navigateur

L'expérience de navigation de fichiers principale avec un système d'onglets moderne supportant les espaces de travail, un nouveau design de barre d'outils de fenêtre avec des contrôles intégrés, et une navigation à double panneau pour une gestion efficace des fichiers.

### Miniatures vidéo

Ajout de miniatures d'aperçu pour les fichiers vidéo dans le navigateur.

### Migration du système de design

Migration de l'application de Vuetify vers Sigma-UI pour un design plus spacieux et moderne avec une qualité de code améliorée.

---

## [2.0.0-alpha.1] - January 2024

**Résumé :** Réécriture complète utilisant des technologies modernes.

### Migration Tauri

Sigma File Manager v2 a été reconstruit de zéro en utilisant Vue 3 Composition API, TypeScript et Tauri v2. La taille d'installation de l'application est passée de 153 Mo à seulement 4 Mo sur Windows. La taille de l'application installée est passée de 419 Mo à 12 Mo.

### Panneaux redimensionnables

Ajout de la fonctionnalité de panneaux redimensionnables qui permet de diviser la vue du navigateur en deux et de travailler avec 2 répertoires côte à côte.

### Fonctionnalités initiales

Navigation de fichiers basique avec listing de répertoires, gestion de fenêtre avec les contrôles réduire, agrandir et fermer, et une structure initiale de page de paramètres.
