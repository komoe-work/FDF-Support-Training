import type { TrainingImage } from './types';

// This data is used as a fallback if no training data is found in localStorage.
// An examiner can add, remove, and modify the training set via the UI.
export const TRAINING_DATA: TrainingImage[] = [
  {
    id: 1,
    imageUrl: 'https://i.imgur.com/2G6202K.png',
    items: [
      { prompt: '243,776', correctAnswer: 'PE シヤカイホケンリヨウトウ*' },
      { prompt: '121,887', correctAnswer: 'PE シヤカイホケンリヨウトウ*' },
      { prompt: '144,450', correctAnswer: 'ジエーシービー' },
      { prompt: '11,000', correctAnswer: 'DF. トータルホウシユウ' },
      { prompt: '308,000', correctAnswer: '振込 ターボソフト(カ' },
    ],
  },
  {
    id: 2,
    imageUrl: 'https://i.imgur.com/Wbixp5F.png',
    items: [
      { prompt: '8,800', correctAnswer: 'ビユーカード' },
      { prompt: '5,000', correctAnswer: 'MHF' },
      { prompt: '10,000', correctAnswer: 'JCB' },
      { prompt: '46,183', correctAnswer: 'アマゾンジャパン' },
      { prompt: '7,000', correctAnswer: '77ギンコウ' },
      { prompt: '300,000', correctAnswer: 'カ)グッドスピード' },
    ],
  },
  {
    id: 3,
    imageUrl: 'https://i.imgur.com/d9j8g1x.png',
    items: [
        { prompt: '660', correctAnswer: 'リソナ' },
        { prompt: '20,000', correctAnswer: 'MHF' },
        { prompt: '35,000', correctAnswer: 'MHF' },
        { prompt: '55,660', correctAnswer: 'AP(ヤフージャパン' },
        { prompt: '50,000', correctAnswer: 'NISA' },
    ]
  }
];