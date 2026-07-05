// Registry of games shown on the home screen.
// To add a new game: append an entry here and add its <Route> in App.jsx.
export const GAMES = [
  {
    id: 'fruit-interdit',
    name: 'Fruit Interdit',
    description: 'Trouvez les fruits cachés et entrez leur code pour marquer.',
    path: '/fruit-interdit',
    emoji: '🍓',
    accent: '#4cc35d',
    enabled: true,
  },
  {
    id: 'soccer-cars',
    name: 'Turbo Soccer',
    description:
      'Deux voitures, un ballon: marquez des buts en frappant le ballon avec le nez de votre bolide.',
    path: '/soccer-cars',
    emoji: '🚗',
    accent: '#3b7de2',
    enabled: true,
  },
  {
    id: 'spin-the-wheel',
    name: 'Spin the Wheel',
    description:
      'Tournez la roue des 32 équipes NFL et bâtissez le meilleur alignement fantasy.',
    path: '/spin-the-wheel',
    emoji: '🏈',
    accent: '#d50a0a',
    enabled: true,
  },
  // Example of a future, not-yet-available game:
  // {
  //   id: 'prochain-jeu',
  //   name: 'Prochain Jeu',
  //   description: 'Bientôt disponible.',
  //   path: '/prochain-jeu',
  //   emoji: '🎮',
  //   accent: '#3b7de2',
  //   enabled: false,
  // },
];
