// Registry of games shown on the home screen.
// To add a new game: append an entry here and add its <Route> in App.jsx.
export const GAMES = [
  {
    id: 'fruit-interdit',
    name: 'Fruit Interdit',
    description: 'Trouvez les fruits cachés et entrez leur code pour marquer.',
    path: '/fruit-interdit',
    emoji: '🍅',
    accent: '#e23b3b',
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
