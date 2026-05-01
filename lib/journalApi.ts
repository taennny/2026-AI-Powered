import api from './api';

export type WritingStyle = 'info' | 'emotion';

export interface GenerateJournalRequest {
  prompt: string;
  writingStyle: WritingStyle;
  photoId?: string;
}

export interface GenerateJournalResponse {
  title: string;
  content: string;
  photoUrl?: string;
}

export interface SaveJournalRequest {
  title: string;
  content: string;
  photoUrl?: string;
}

export const uploadPhoto = async (imageUri: string) => {
  const formData = new FormData();

  formData.append('photo', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  const response = await api.post('/api/v1/photos/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const generateJournal = async (data: GenerateJournalRequest) => {
  const response = await api.post<GenerateJournalResponse>(
    '/api/v1/journals/generate',
    data,
  );

  return response.data;
};

export const saveJournal = async (data: SaveJournalRequest) => {
  const response = await api.post('/api/v1/journals', data);

  return response.data;
};
