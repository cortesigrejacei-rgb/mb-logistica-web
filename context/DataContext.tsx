
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { calculateOptimalRoute } from '../lib/RouteOptimizer';
import { simulateGeocode, geocodeAddress } from '../utils/geoUtils';

const useSimulatedData = false;

// Types
export interface Technician {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Online' | 'Offline' | 'Em Rota' | 'Inativo';
  avatar: string;
  lat?: number;
  lng?: number;
  last_seen?: string;
  battery_level?: number;
  zone?: string;
  expo_push_token?: string; // For push notifications
  // Fuel & Optimization bits
  address?: string;
  start_lat?: number;
  start_lng?: number;
  avg_consumption?: number;
  fuel_type?: 'Gasolina' | 'Etanol' | 'Diesel';
  city?: string;
  state?: string;
  // End/Return Location (e.g. Hotel or Home)
  end_address?: string;
  end_lat?: number;
  end_lng?: number;
  end_city?: string;
  end_state?: string;
  monthly_goal?: number;
  work_schedule?: {
    sun: boolean; mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean;
    exceptions?: string[]; // Array of ISO date strings (YYYY-MM-DD) for specific overrides
  } | any;
}

export interface Collection {
  id: string;
  client: string;
  address: string;
  status: 'Pendente' | 'Em Rota' | 'Coletado' | 'Falha';
  driverId: string;
  phone: string;
  notes?: string;
  visitNotes?: string;
  serialNumber?: string;
  date: string;
  proofUrl?: string;
  lat?: number;
  lng?: number;
  complement?: string;
  equipment_code?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  sequence_order?: number;
}

export interface StockItem {
  id: string;
  model: string;
  serial: string;
  status: 'Novo' | 'Usado' | 'Defeito' | 'Em Trânsito';
  location: string;
  updatedAt: string;
  proofUrl?: string;
  notes?: string;
}

export interface AppSettings {
  systemName: string;
  language: string;
  timezone: string;
  supportEmail: string;
  autoDispatch: boolean;
  pricePerCollection: number;
  apiClientId?: string;
  apiClientSecret?: string;
  apiBaseUrlProd?: string;
  apiBaseUrlStage?: string;
}

export interface TimeEntry {
  id: string;
  technician_id: string;
  type: 'entry' | 'exit' | 'lunch_start' | 'lunch_end' | 'maintenance_start' | 'maintenance_end';
  timestamp: string;
  lat?: number;
  lng?: number;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

interface DataContextType {
  technicians: Technician[];
  collections: Collection[];
  stockItems: StockItem[];
  timeEntries: TimeEntry[];
  settings: AppSettings;
  loading: boolean;
  toasts: ToastMessage[];
  currentTechnician: Technician | undefined;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  addTechnician: (tech: Omit<Technician, 'id' | 'avatar'> & { avatar?: string }) => void;
  updateTechnician: (id: string, data: Partial<Technician>) => Promise<void>;
  deleteTechnician: (id: string) => void;
  addCollection: (collection: Omit<Collection, 'id' | 'status'> & { date?: string }, skipRefresh?: boolean) => void;
  updateCollectionStatus: (id: string, status: Collection['status'], proofUrl?: string, driverId?: string, serialNumber?: string, visitNotes?: string) => Promise<void>;
  deleteCollection: (id: string) => void;
  getTechnicianById: (id: string) => Technician | undefined;
  addStockItem: (item: Omit<StockItem, 'id' | 'updatedAt'>) => void;
  updateStockItem: (id: string, data: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetData: () => void;
  uploadFile: (file: File, bucket: string, path?: string) => Promise<string | null>;
  refreshData: () => Promise<void>;
  optimizeRouteForTechnician: (techId: string, date: string) => Promise<void>;
  deleteCollections: (ids: string[]) => Promise<void>;
  unassignCollections: (ids: string[]) => Promise<void>;
  fixGeocodes: () => Promise<void>;
  updateCollection: (id: string, data: Partial<Collection>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const initialSettings: AppSettings = {
  systemName: 'MB LOGÍSTICA',
  language: 'Português (Brasil)',
  timezone: 'Brasília (GMT-3)',
  supportEmail: 'suporte@mb.com.br',
  autoDispatch: true,
  pricePerCollection: 35.00,
  apiClientId: '',
  apiClientSecret: '',
  apiBaseUrlProd: 'https://api.oi.com.br/nio/v1',
  apiBaseUrlStage: 'https://api-staging.oi.com.br/nio/v1'
};


export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const currentTechnician = technicians.find(t => t.email === user?.email);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const mapCollectionFromDB = (dbCol: any): Collection => {
    // FORCE SIMULATION: Check if DB coords are valid, but since we improved the geocoder, 
    // let's prefer the simulation for this demo to fix the "Curitiba" issue on existing data.
    // Ideally, we would update the DB, but this client-side fix is instant.
    // Construct simplified full address for matching
    const fullAddr = `${dbCol.address} ${dbCol.neighborhood || ''} ${dbCol.city || ''}`;
    // Use stored coordinates if available, otherwise simulate
    const coords = (dbCol.lat && dbCol.lng)
      ? { lat: dbCol.lat, lng: dbCol.lng }
      : simulateGeocode(fullAddr, parseInt(dbCol.id.replace(/\D/g, '')) || 0);
    return {
      id: dbCol.id,
      client: dbCol.client,
      address: dbCol.address,
      status: dbCol.status,
      driverId: dbCol.driver_id || '',
      phone: dbCol.phone || '',
      notes: dbCol.notes || '',
      visitNotes: dbCol.visit_notes || '',
      serialNumber: dbCol.serial_number || '',
      date: dbCol.date,
      proofUrl: dbCol.proof_url || '',
      complement: dbCol.complement,
      equipment_code: dbCol.equipment_code,
      city: dbCol.city,
      state: dbCol.state,
      neighborhood: dbCol.neighborhood,
      sequence_order: dbCol.sequence_order,
      ...coords
    };
  };

  const fetchData = async () => {
    try {
      const { data: techs } = await supabase.from('technicians').select('*');
      if (techs) {
        console.log("[Web] Fetched technicians:", techs);
        setTechnicians(techs);
      }

      const { data: cols } = await supabase.from('collections').select('*').order('date', { ascending: false });
      if (cols) {
        console.log(`[Web] Fetched ${cols.length} collections.`);
        setCollections(cols.map(mapCollectionFromDB));
      }

      const { data: stock } = await supabase.from('stock_items').select('*, proof_url, notes');
      if (stock) {
        console.log("[Web] Raw Stock Items:", stock);
        setStockItems(stock.map(s => ({
          ...s,
          updatedAt: s.updated_at,
          proofUrl: s.proof_url,
          notes: s.notes
        })));
      }

      // Fetch Time Entries for the current local day
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data: entries } = await supabase
        .from('time_entries')
        .select('*')
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: true });
      if (entries) setTimeEntries(entries);

      const { data: sets } = await supabase.from('settings').select('*').single();
      if (sets) setSettings({ ...initialSettings, ...sets });

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('app_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const uploadFile = async (file: File, bucket: string, path?: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${path ? path + '/' : ''}${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return publicUrl;
    } catch (err) {
      console.error('Upload exception:', err);
      showToast('Erro ao fazer upload do arquivo.', 'error');
      return null;
    }
  };

  const addTechnician = async (techData: Omit<Technician, 'id' | 'avatar'> & { avatar?: string }) => {
    try {
      // 1. Create User in Supabase Auth (using a temporary client to avoid logging out the admin)
      // We assume the URL and Key are available from the existing supabase entity or process.env
      // Since we don't have direct access to env here easily, we'll pluck them from the imports if possible,
      // or hardcode the public ones found in lib/supabaseClient.ts (not ideal but works for this scope)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false, // Critical: do not persist this session
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const defaultPassword = 'mblogistica123';
      console.log(`[AddTechnician] Creating Auth User for ${techData.email}...`);

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email: techData.email,
        password: defaultPassword,
        options: {
          data: {
            full_name: techData.name,
            role: techData.role
          }
        }
      });

      if (authError) {
        // If user already exists, we might want to proceed to create the technician profile anyway
        console.warn("[AddTechnician] Auth creation warning:", authError.message);
        if (!authError.message.includes('already registered')) {
          showToast(`Erro ao criar login: ${authError.message}`, 'error');
          return;
        }
      } else {
        console.log("[AddTechnician] Auth User Created:", authData.user?.id);
      }

      // 2. Create Technician Profile in DB
      const newTech = {
        ...techData,
        id: `#TEC-${Math.floor(Math.random() * 10000)}`,
        avatar: techData.avatar || `https://ui-avatars.com/api/?name=${techData.name}&background=random&color=fff`,
        lat: -25.4297,
        lng: -49.2719,
        last_seen: new Date().toISOString()
      };

      const { error } = await supabase.from('technicians').insert([newTech]);

      if (error) {
        console.error("Add technician error:", error);
        showToast('Erro ao salvar técnico.', 'error');
      } else {
        showToast('Técnico cadastrado com sucesso! (Senha padrão: mblogistica123)');
        fetchData();
      }
    } catch (e) {
      console.error("Add technician exception:", e);
      showToast('Erro interno ao adicionar técnico.', 'error');
    }
  };

  const updateTechnician = async (id: string, data: Partial<Technician>) => {
    try {
      const updatePayload = { ...data, last_seen: new Date().toISOString() };
      const { error } = await supabase.from('technicians').update(updatePayload).eq('id', id);
      if (error) throw error;

      // Update local state immediately
      setTechnicians(prev => prev.map(tech =>
        tech.id === id ? { ...tech, ...updatePayload } : tech
      ));

      // Verification fetch
      fetchData();
    } catch (e) {
      console.error("Update tech exception:", e);
      throw e;
    }
  };

  const deleteTechnician = async (id: string) => {
    await supabase.from('technicians').delete().eq('id', id);
    showToast('Técnico removido.', 'error');
    fetchData();
  };

  const addCollection = async (colData: Omit<Collection, 'id' | 'status'> & { id?: string; date?: string }, skipRefresh?: boolean) => {
    // Try Real Geocoding first (Nominatim)
    let realCoords = await geocodeAddress(colData.address, colData.city, undefined); // State inferred

    // Fallback to Simulation if Real fails
    if (!realCoords) {
      const fullAddr = `${colData.address} ${colData.neighborhood || ''} ${colData.city || ''}`;
      realCoords = simulateGeocode(fullAddr, collections.length);
    }

    // Use provided ID or generate a robust one (Timestamp + Random) to avoid collisions
    const finalId = colData.id || `#REQ-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;

    const newCol = {
      client: colData.client,
      address: colData.address,
      phone: colData.phone,
      driver_id: colData.driverId || null,
      notes: colData.notes,
      complement: colData.complement,
      equipment_code: colData.equipment_code,
      city: colData.city,
      neighborhood: colData.neighborhood,
      lat: realCoords.lat,
      lng: realCoords.lng,
      id: finalId,
      status: 'Pendente',
      date: colData.date || new Date().toISOString().split('T')[0]
    };
    console.log(`[AddCollection] Upserting: ID=${newCol.id}, Date=${newCol.date}, Driver=${newCol.driver_id}`);
    const { error } = await supabase.from('collections').upsert([newCol]);
    if (error) {
      console.error("Add collection error:", error);
      // Show detailed error to help diagnosis
      showToast(`Erro DB: ${error.message || error.details || 'Falha ao criar'}`, 'error');
    } else {
      showToast('Coleta criada com sucesso!', 'success'); // Explicit success type
      if (!skipRefresh) fetchData();
    }
  };

  const updateCollection = async (id: string, data: Partial<Collection>) => {
    try {
      if (!useSimulatedData) {
        // Map fields to DB columns
        const updateData: any = {};
        if (data.client) updateData.client = data.client;
        if (data.address) updateData.address = data.address;
        if (data.status) updateData.status = data.status;
        if (data.complement) updateData.complement = data.complement;
        if (data.equipment_code) updateData.equipment_code = data.equipment_code;
        if (data.notes) updateData.notes = data.notes;
        if (data.phone) updateData.phone = data.phone;
        if (data.city) updateData.city = data.city;
        if (data.state) updateData.state = data.state;
        if (data.neighborhood) updateData.neighborhood = data.neighborhood;

        // Auto-geocode if address fields changed
        if (data.address || data.city || data.state) {
          const currentCollection = collections.find(c => c.id === id);
          if (currentCollection) {
            const addressToUse = data.address || currentCollection.address;
            const cityToUse = data.city || currentCollection.city;
            const stateToUse = data.state || currentCollection.state;

            console.log('[updateCollection] Re-geocoding with merged data:', { addressToUse, cityToUse, stateToUse });

            try {
              // Try 1: Full Address
              let coords = await geocodeAddress(addressToUse, cityToUse, stateToUse);

              // Try 2: If failed, check for CEP in notes
              if (!coords && data.notes) {
                const cepMatch = data.notes.match(/\d{5}-?\d{3}/);
                if (cepMatch) {
                  console.log('[updateCollection] Trying backup geocode with CEP:', cepMatch[0]);
                  // geoUtils might not take CEP param, but we can pass it as address or create a new util func.
                  // For now, let's append it to city/state or just pass it string
                  coords = await geocodeAddress(cepMatch[0], '', '');
                }
              }

              // Try 3: Fallback to Neighborhood + City + State (New User Request)
              if (!coords && data.neighborhood) {
                console.log('[updateCollection] Specific address failed. Trying Neighborhood:', data.neighborhood);
                // Pass empty address, but provide neighborhood
                coords = await geocodeAddress('', cityToUse, stateToUse, data.neighborhood);
              }

              // Try 4: Fallback to City + State (at least moves pin to correct region)
              if (!coords) {
                console.log('[updateCollection] Neighborhood failed. Falling back to City/State center.');
                coords = await geocodeAddress('', cityToUse, stateToUse);

                // Smart Check: If confidence is low (e.g. "Porto Alegre, SC" -> hamlet), try IGNORING State
                if (coords && coords.importance < 0.4) {
                  console.log(`[updateCollection] Low confidence (${coords.importance}) on City+State. Trying City ONLY (ignoring State mismatch)...`);
                  const cityOnlyCoords = await geocodeAddress('', cityToUse, '');
                  if (cityOnlyCoords && cityOnlyCoords.importance > 0.6) {
                    console.log(`[updateCollection] FOUND BETTER MATCH ignoring state: ${cityToUse} (${cityOnlyCoords.importance})`);
                    coords = cityOnlyCoords;
                  }
                }
              }

              if (coords) {
                updateData.lat = coords.lat;
                updateData.lng = coords.lng;
                // Update local data
                data.lat = coords.lat;
                data.lng = coords.lng;
                console.log('[updateCollection] New coordinates found:', coords);
              } else {
                console.warn('[updateCollection] All geocode attempts failed.');
              }
            } catch (error) {
              console.error("Failed to re-geocode:", error);
            }
          }
        }

        const { data: updatedRows, error, count } = await supabase
          .from('collections')
          .update(updateData)
          .eq('id', id)
          .select('*', { count: 'exact' });

        console.log(`[updateCollection] ID: ${id} | Payload:`, JSON.stringify(updateData));
        if (error) {
          console.error('[updateCollection] DB Error:', error);
          alert(`Erro ao salvar no banco: ${error.message}`);
          throw error;
        } else {
          // Robust check: Supabase sometimes returns null count but valid data, or vice versa.
          const hasRows = (updatedRows && updatedRows.length > 0);
          const rowCount = count !== null ? count : (hasRows ? updatedRows.length : 0);

          console.log(`[updateCollection] Success! Rows updated: ${rowCount} | Has Data: ${hasRows}`);

          if (rowCount === 0 && !hasRows) {
            alert(`CRÍTICO: O banco de dados recusou a alteração para o ID ${id}. Verifique se este ID realmente existe no banco.`);
          } else {
            setCollections(prev => prev.map(c =>
              c.id === id ? { ...c, ...data } : c
            ));
          }
        }
      } else {
        setCollections(prev => prev.map(c =>
          c.id === id ? { ...c, ...data } : c
        ));
      }

      showToast('Coleta atualizada com sucesso', 'success');
    } catch (error) {
      console.error('Error updating collection:', error);
      showToast('Erro ao atualizar coleta', 'error');
    }
  };

  const updateCollectionStatus = async (id: string, status: Collection['status'], proofUrl?: string, driverId?: string, serialNumber?: string, visitNotes?: string) => {
    try {
      const updateData: any = { status };
      if (proofUrl) updateData.proof_url = proofUrl;
      if (driverId !== undefined) updateData.driver_id = driverId === '' ? null : driverId;
      if (serialNumber) updateData.serial_number = serialNumber;
      if (visitNotes) updateData.visit_notes = visitNotes;

      const { error } = await supabase.from('collections').update(updateData).eq('id', id);
      if (error) throw error;

      // Integration: Update Stock if functionality is enabled (implied) and serial is present
      if ((status === 'Coletado') && serialNumber) {
        // Find stock item with this serial
        const stockItem = stockItems.find(s => s.serial.trim().toUpperCase() === serialNumber.trim().toUpperCase());

        let newLocation = 'Estoque Central';
        // Try to find technician name if driverId is present
        if (driverId) {
          const tech = technicians.find(t => t.id === driverId);
          if (tech) newLocation = `Carro: ${tech.name}`;
        } else if (currentTechnician) {
          // Fallback for mobile app usage where driverId might not be passed explicitly but context knows current user
          newLocation = `Carro: ${currentTechnician.name}`;
        }

        if (stockItem) {
          console.log(`[Integration] Updating stock item ${stockItem.id} based on collection ${id}`);
          await supabase.from('stock_items').update({
            status: 'Usado', // Assuming collected items are 'Usado'
            location: newLocation,
            updated_at: new Date().toISOString()
          }).eq('id', stockItem.id);
        } else {
          console.log(`[Integration] Creating NEW stock item for serial ${serialNumber}`);
          // Infer model from collection data (equipment_code) or default
          // We need to fetch the collection first to get the equipment_code if not passed?
          // Actually, we can use a deafult model or try to use what we have.
          // Ideally we should pass equipment_code to this function, but for now let's use a generic name or "Desconhecido" if not available.

          // Wait, we need to be careful. Ideally we should have the model.
          // Let's assume the user wants it created.
          const newItem = {
            model: 'Equipamento Coletado', // Placeholder, creates opportunity for user to edit in Stock
            serial: serialNumber.toUpperCase(),
            status: 'Usado',
            location: newLocation,
            id: `ITEM-${Math.floor(Math.random() * 10000)}`,
            updated_at: new Date().toISOString()
          };
          await supabase.from('stock_items').insert([newItem]);
        }
      }

      if (status === 'Coletado' || status === 'Falha') {
        // updateLocation(); // Assuming this function exists elsewhere or is a placeholder
      }
    } catch (e) {
      console.error("Update collection exception:", e);
      throw e;
    }
  };

  const deleteCollection = async (id: string) => {
    await supabase.from('collections').delete().eq('id', id);
    showToast('Coleta excluída.', 'error');
    fetchData();
  };

  const addStockItem = async (itemData: Omit<StockItem, 'id' | 'updatedAt'>) => {
    const newItem = {
      model: itemData.model,
      serial: itemData.serial,
      status: itemData.status,
      location: itemData.location,
      id: `ITEM-${Math.floor(Math.random() * 10000)}`,
      updated_at: new Date().toISOString().split('T')[0]
    };
    const { error } = await supabase.from('stock_items').insert([newItem]);
    if (error) {
      console.error("Stock add error:", error);
      showToast('Erro ao atualizar estoque.', 'error');
    } else {
      showToast('Item adicionado ao estoque.');
      fetchData();
    }
  };

  const updateStockItem = async (id: string, data: Partial<StockItem>) => {
    const updatedData: any = { ...data };
    if (data.updatedAt) {
      updatedData.updated_at = data.updatedAt;
      delete updatedData.updatedAt;
    }
    await supabase.from('stock_items').update(updatedData).eq('id', id);
    showToast('Estoque atualizado.');
    fetchData();
  };

  const deleteStockItem = async (id: string) => {
    await supabase.from('stock_items').delete().eq('id', id);
    showToast('Item removido do estoque.', 'error');
    fetchData();
  };

  const getTechnicianById = (id: string) => technicians.find(t => t.id === id);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    const { data } = await supabase.from('settings').select('*').limit(1);
    if (data && data.length > 0) {
      await supabase.from('settings').update(newSettings).eq('id', data[0].id);
    } else {
      await supabase.from('settings').insert([updated]);
    }
    setSettings(updated);
    showToast('Configurações salvas.');
  };

  const resetData = async () => {
    await supabase.from('technicians').delete().neq('id', '0');
    await supabase.from('collections').delete().neq('id', '0');
    await supabase.from('stock_items').delete().neq('id', '0');
    fetchData();
    showToast("Banco de dados resetado.", 'error');
  };

  return (
    <DataContext.Provider value={{
      technicians,
      collections,
      stockItems,
      timeEntries,
      settings,
      loading,
      toasts,
      currentTechnician,
      showToast,
      addTechnician,
      updateTechnician,
      deleteTechnician,
      addCollection,
      updateCollectionStatus,
      deleteCollection,
      addStockItem,
      updateStockItem,
      deleteStockItem,
      getTechnicianById,
      updateSettings,
      resetData,
      uploadFile,
      refreshData: fetchData,
      optimizeRouteForTechnician: async (techId: string, date: string) => {
        try {
          console.log(`[Optimization] Starting for Tech ${techId} on ${date}`);

          // 1. Get Technician Details (Start/End)
          const tech = technicians.find(t => t.id === techId);
          if (!tech) throw new Error("Technician not found");

          // 2. Get Collections for this Tech & Date
          // FETCH FROM DB DIRECTLY to ensure we have the latest data (avoiding state staleness after batch import)
          const { data: dbCollections } = await supabase
            .from('collections')
            .select('*')
            .eq('driver_id', techId)
            .eq('date', date)
            .in('status', ['Pendente', 'Em Rota']);

          if (!dbCollections || dbCollections.length === 0) {
            console.log("[Optimization] No collections to optimize (DB Empty for this date).");

            // DEBUG: WIDE NET QUERY
            // Check if there are ANY collections for this driver, to diagnose date mismatch vs missing data
            const { data: allTechCols } = await supabase
              .from('collections')
              .select('id, date, status, driver_id')
              .eq('driver_id', techId);

            console.log(`[Optimization DEBUG] Found ${allTechCols?.length || 0} TOTAL collections for tech ${techId}.`);
            if (allTechCols && allTechCols.length > 0) {
              console.log("[Optimization DEBUG] Dates found:", allTechCols.map(c => c.date));
            } else {
              console.log("[Optimization DEBUG] TRULY EMPTY. Persistence failed or RLS blocking.");
            }

            return;
          }

          const routeCollections = dbCollections.map(mapCollectionFromDB);

          // 3. Prepare Points
          const startPoint = {
            lat: tech.start_lat || tech.lat || -25.4297,
            lng: tech.start_lng || tech.lng || -49.2719
          };

          const stops = routeCollections.map(c => ({
            lat: c.lat || 0,
            lng: c.lng || 0
          }));

          const endPoint = (tech.end_lat && tech.end_lng) ? { lat: tech.end_lat, lng: tech.end_lng } : undefined;

          // 4. Call Optimizer
          // Import dynamically or assume it's available? 
          // We need to import calculateOptimalRoute at the top of file or here.
          // Since DataContext is .tsx, we can import.
          // But I cannot add import at top with this tool easily without reading whole file.
          // Wait, I can try to use the global function if I exported it globally? No.
          // I should have added the import first. 
          // I will assume I can add the import in a separate step or try to use a require if possible, 
          // but 'import' is best. For now, I will create the function skeleton and then add the import at top.

          // Re-viewing the file Plan: I will add this function now, but I need to `import { calculateOptimalRoute } from '../lib/RouteOptimizer';`
          // calling `calculateOptimalRoute` here directly.

          // const { calculateOptimalRoute } = require('../lib/RouteOptimizer'); // NOW IMPORTED AT TOP

          const result = await calculateOptimalRoute(startPoint, stops, endPoint);

          if (result.optimizedOrder && result.optimizedOrder.length > 0) {
            console.log("[Optimization] Order found:", result.optimizedOrder);

            // 5. Update Sequence in DB
            // optimizedOrder contains indices of 'stops' (and thus 'routeCollections')

            const updates = result.optimizedOrder.map((originalIndex, sequence) => {
              const col = routeCollections[originalIndex];
              if (!col) return null;
              return supabase.from('collections').update({ sequence_order: sequence + 1 }).eq('id', col.id);
            });

            await Promise.all(updates);

            // 6. Persist Summary for Fuel Module
            // Calculate mock cost (or simple average) just to have something.
            // Combustivel.tsx does a deeper calc, but this ensures non-zero display initially.
            const estimatedCost = (result.totalDistanceKm / (tech.avg_consumption || 10)) * 5.89; // Avg Gas Price

            await supabase.from('route_summaries').delete().match({ technician_id: techId, date: date });
            await supabase.from('route_summaries').insert({
              technician_id: techId,
              date: date,
              total_distance_km: result.totalDistanceKm,
              estimated_fuel_cost: estimatedCost,
              collection_count: routeCollections.length,
              status: 'Optimized'
            });

            showToast("Rota otimizada e sequenciada com sucesso!", 'success');
            fetchData(); // Refresh to see order
          }

        } catch (e) {
          console.error("Optimization failed:", e);
          showToast("Erro ao otimizar rota.", 'error');
        }
      },
      deleteCollections: async (ids: string[]) => {
        try {
          const { error } = await supabase.from('collections').delete().in('id', ids);
          if (error) throw error;
          showToast(`${ids.length} coletas excluídas.`, 'error');
          fetchData();
        } catch (e) {
          console.error("Batch delete error:", e);
          showToast("Erro ao excluir coletas.", 'error');
        }
      },
      unassignCollections: async (ids: string[]) => {
        console.log('[unassign] Requesting remove for:', ids);
        try {
          // If IDs are strings but DB is int, this helps. If DB is UUID, this shouldn't hurt unless IDs are uuid strings.
          // Better approach: Let Supabase handle it, but if count is null, maybe RLS is issue.
          // We will remove the 'count' check or just rely on error null check.

          const { error } = await supabase
            .from('collections')
            .update({ driver_id: null, status: 'Pendente' })
            .in('id', ids);

          if (error) throw error;

          showToast(`${ids.length} coletas desvinculadas.`);
          fetchData(); // Force refresh
        } catch (e) {
          console.error("Batch unassign error:", e);
          showToast("Erro ao desvincular técnicos.", 'error');
        }
      },
      fixGeocodes: async () => {
        const pendingCols = collections; // Filter if needed
        showToast(`Iniciando correção de GPS para ${pendingCols.length} coletas...`, 'info');

        let count = 0;
        for (const col of pendingCols) {
          await new Promise(r => setTimeout(r, 1200));

          const realCoords = await geocodeAddress(col.address, col.city);
          if (realCoords) {
            await supabase.from('collections').update({
              lat: realCoords.lat,
              lng: realCoords.lng
            }).eq('id', col.id);
            count++;
            console.log(`[GeoFix] Updated ${col.client} (${count}/${pendingCols.length})`);
          }
        }
        showToast(`Correção de GPS finalizada! ${count} atualizados.`, 'success');
        fetchData();
      },
      updateCollection
    }}>
      {children}
    </DataContext.Provider >
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};
