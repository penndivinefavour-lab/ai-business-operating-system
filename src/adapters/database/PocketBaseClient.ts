// src/adapters/database/PocketBaseClient.ts

export interface PBRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
  [key: string]: unknown;
}

export interface PBListResult<T> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: (T & PBRecord)[];
}

export class PocketBaseClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = 'http://localhost:8090') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async authenticate(email: string, password: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const data = (await res.json()) as { token: string };
    this.authToken = data.token;
  }

  async create(collection: string, data: Record<string, unknown>): Promise<PBRecord> {
    // Remove id if empty - PocketBase will auto-generate a 15-char id
    const body = { ...data };
    if (!body.id || typeof body.id !== 'string' || body.id.length !== 15) {
      delete body.id;
    }
    
    const res = await fetch(`${this.baseUrl}/api/collections/${collection}/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: this.authToken } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as PBRecord;
  }

  async getFirstListItem(collection: string, filter: string): Promise<PBRecord> {
    const filterParam = encodeURIComponent(filter);
    const res = await fetch(
      `${this.baseUrl}/api/collections/${collection}/records?filter=${filterParam}&perPage=1`,
      {
        headers: this.authToken ? { Authorization: this.authToken } : {},
      }
    );
    if (!res.ok) throw new Error(`Get failed: ${res.status}`);
    const data = (await res.json()) as PBListResult<never>;
    if (!data.items?.length) throw new Error(`No records found: ${collection} ${filter}`);
    return data.items[0];
  }

  async list(collection: string, filter?: string, page = 1, perPage = 50): Promise<PBListResult<never>> {
    let url = `${this.baseUrl}/api/collections/${collection}/records?page=${page}&perPage=${perPage}`;
    if (filter) url += `&filter=${encodeURIComponent(filter)}`;
    const res = await fetch(url, {
      headers: this.authToken ? { Authorization: this.authToken } : {},
    });
    if (!res.ok) throw new Error(`List failed: ${res.status}`);
    return (await res.json()) as PBListResult<never>;
  }

  async update(collection: string, id: string, data: Record<string, unknown>): Promise<PBRecord> {
    const res = await fetch(`${this.baseUrl}/api/collections/${collection}/records/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: this.authToken } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    return (await res.json()) as PBRecord;
  }

  async delete(collection: string, id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/collections/${collection}/records/${id}`, {
      method: 'DELETE',
      headers: this.authToken ? { Authorization: this.authToken } : {},
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  }

  getAuthToken(): string | null {
    return this.authToken;
  }
}
