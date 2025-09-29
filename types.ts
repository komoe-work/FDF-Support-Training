export enum Role {
  Admin = 'Admin',
  Examiner = 'Examiner',
  Trainee = 'Trainee',
}

export interface User {
  id: number;
  username: string;
  password?: string;
  role: Role;
}

export interface TrainingItem {
  prompt: string;
  correctAnswer: string;
}

export interface TrainingImage {
  id: number;
  imageUrl: string;
  items: TrainingItem[];
}

export interface UserResultItem {
  prompt: string;
  userInput: string;
  isCorrect: boolean;
}

export interface UserResult {
  imageId: number;
  items: UserResultItem[];
  timeTaken: number; // in seconds
}

export interface TrainingAttempt {
  username: string;
  timestamp: number;
  results: UserResult[];
  totalTime: number;
  totalItems: number;
  correctItems: number;
  accuracy: number;
}

export interface AppBackup {
  users: User[];
  trainingData: TrainingImage[];
  attempts: TrainingAttempt[];
}

export enum View {
    Login,
    Dashboard,
    Training,
    Results,
    ExaminerSetup,
    AdminDashboard,
}
