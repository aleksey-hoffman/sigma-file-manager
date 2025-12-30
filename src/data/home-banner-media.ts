// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type BannerMedia = {
  name: string;
  fileName: string;
  type: 'image' | 'video';
  author: string;
  positionX: number;
  positionY: number;
};

export const homeBannerMedia: BannerMedia[] = [
  {
    name: 'Glowing Chinese city in mountains',
    fileName: 'Glowing Chinese city in mountains by Aleksey Hoffman.jpg',
    type: 'image',
    author: 'Aleksey Hoffman',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Cyberpunk street',
    fileName: 'Cyberpunk street by Aleksey Hoffman.jpg',
    type: 'image',
    author: 'Aleksey Hoffman',
    positionX: 50,
    positionY: 30,
  },
  {
    name: 'Serenity',
    fileName: 'Serenity by Alena Aenami.jpg',
    type: 'image',
    author: 'Alena Aenami',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Wait',
    fileName: 'Wait by Alena Aenami.jpg',
    type: 'image',
    author: 'Alena Aenami',
    positionX: 50,
    positionY: 40,
  },
  {
    name: 'Out of time',
    fileName: 'Out of time by Alena Aenami.jpg',
    type: 'image',
    author: 'Alena Aenami',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Dragon\'s Nest',
    fileName: 'Dragon\'s Nest by Klaus Pillon.jpg',
    type: 'image',
    author: 'Klaus Pillon',
    positionX: 50,
    positionY: 30,
  },
  {
    name: 'The City Before The Wall',
    fileName: 'The City Before The Wall by Klaus Pillon.jpg',
    type: 'image',
    author: 'Klaus Pillon',
    positionX: 50,
    positionY: 40,
  },
  {
    name: 'Cyber Neon City',
    fileName: 'Cyber Neon City by Laury Guintrand.jpg',
    type: 'image',
    author: 'Laury Guintrand',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Ice Cave',
    fileName: 'Ice Cave by Wang Jie.jpg',
    type: 'image',
    author: 'Wang Jie',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Discovered planet',
    fileName: 'Discovered planet by Darius Kalinauskas.jpg',
    type: 'image',
    author: 'Darius Kalinauskas',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Futuristic Japanese Palanquin',
    fileName: 'Futuristic Japanese Palanquin by Julien Gauthier.jpg',
    type: 'image',
    author: 'Julien Gauthier',
    positionX: 50,
    positionY: 40,
  },
  {
    name: 'Environment Explorations',
    fileName: 'Environment Explorations by Marcel van Vuuren.jpg',
    type: 'image',
    author: 'Marcel van Vuuren',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Maffei 2',
    fileName: 'Maffei 2 by Vadim Sadovski.jpg',
    type: 'image',
    author: 'Vadim Sadovski',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Canyon',
    fileName: 'Canyon by Kevin Lanceplaine.jpg',
    type: 'image',
    author: 'Kevin Lanceplaine',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Abstract',
    fileName: 'Abstract by Johannes Plenio.jpg',
    type: 'image',
    author: 'Johannes Plenio',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'The Legends of Star dust',
    fileName: 'The Legends of Star dust by Ahmed Teilab.jpg',
    type: 'image',
    author: 'Ahmed Teilab',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'INCREASE',
    fileName: 'INCREASE by Sweeper3d (Austin Richey).jpg',
    type: 'image',
    author: 'Sweeper3d (Austin Richey)',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Lip Sync',
    fileName: 'Lip Sync by Han Yang.jpg',
    type: 'image',
    author: 'Han Yang',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Abstract painting',
    fileName: 'Abstract painting by Suzy Hazelwood.jpg',
    type: 'image',
    author: 'Suzy Hazelwood',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Land before Wi-Fi',
    fileName: 'Land before Wi-Fi by Dana Franklin.jpg',
    type: 'image',
    author: 'Dana Franklin',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Drone Footage Of The Waterfalls And The Mountain',
    fileName: 'Drone Footage Of The Waterfalls And The Mountain by Taryn Elliott.mp4',
    type: 'video',
    author: 'Taryn Elliott',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Starry Sky',
    fileName: 'Starry Sky by Andreas.mp4',
    type: 'video',
    author: 'Andreas',
    positionX: 50,
    positionY: 50,
  },
  {
    name: 'Slum',
    fileName: 'Slum by Vladimir Manyukhin (animated by Aleksey Hoffman).mp4',
    type: 'video',
    author: 'Vladimir Manyukhin (animated by Aleksey Hoffman)',
    positionX: 50,
    positionY: 50,
  },
];

export const defaultBannerIndex = 0;
