import { supabase } from '@/integrations/supabase/client';
import { Roster, DailyShift } from '@/integrations/supabase/types';

export class RosterService {
  private static async checkTableExists(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('rosters')
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST116') {
          console.error('Rosters table does not exist:', error);
          return false;
        }
        throw error;
      }
      return true;
    } catch (error) {
      console.error('Error checking rosters table:', error);
      return false;
    }
  }

  static async getRosters(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    department_id?: string;
  }): Promise<Roster[]> {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) {
        throw new Error('Roster system is not properly initialized. Please contact support.');
      }

      let query = supabase
        .from('rosters')
        .select(`
          id,
          employee_id,
          department_id,
          position,
          start_date,
          end_date,
          shift_pattern,
          notes,
          is_active,
          created_at,
          updated_at,
          created_by,
          updated_by,
          assignment_time,
          completion_time
        `);

      // Only apply status filter if it's provided
    if (filters?.status) {
        // For now, we'll determine status based on dates if the column doesn't exist
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        switch (filters.status.toLowerCase()) {
          case 'active':
            query = query
              .lte('start_date', today)
              .gte('end_date', today);
            break;
          case 'completed':
            query = query
              .lt('end_date', today);
            break;
          case 'upcoming':
            query = query
              .gt('start_date', today);
            break;
        }
      }

    if (filters?.startDate) {
      query = query.gte('start_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('end_date', filters.endDate);
    }
      if (filters?.department_id) {
        query = query.eq('department_id', filters.department_id);
    }

    const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching rosters:', error);
        throw new Error('Failed to fetch roster information. Please try again or contact support.');
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Calculate status based on dates if the status column doesn't exist
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Transform the data to match the Roster interface
      return data.map(roster => {
        // Determine status based on dates
        let status: 'active' | 'completed' | 'upcoming' = 'active';
        if (roster.end_date < today) {
          status = 'completed';
        } else if (roster.start_date > today) {
          status = 'upcoming';
        }

        return {
          id: roster.id,
          employee_id: roster.employee_id,
          department_id: roster.department_id,
          position: roster.position,
          start_date: roster.start_date,
          end_date: roster.end_date,
          shift_pattern: roster.shift_pattern || [],
          notes: roster.notes,
          is_active: roster.is_active ?? true,
          status: roster.status || status,
          grace_period: roster.grace_period ?? 15, // Default to 15 minutes if not set
          created_at: roster.created_at,
          updated_at: roster.updated_at,
          created_by: roster.created_by,
          updated_by: roster.updated_by,
          assignment_time: roster.assignment_time,
          completion_time: roster.completion_time
        };
      });
    } catch (error) {
      console.error('Error in getRosters:', error);
      throw error;
    }
  }

  static async getRosterById(id: string): Promise<Roster | null> {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) {
        throw new Error('Roster system is not properly initialized. Please contact support.');
      }

    const { data, error } = await supabase
      .from('rosters')
        .select(`
          id,
          employee_id,
          department_id,
          position,
          start_date,
          end_date,
          shift_pattern,
          notes,
          is_active,
          status,
          created_at,
          updated_at,
          created_by,
          updated_by,
          assignment_time,
          completion_time
        `)
      .eq('id', id)
      .single();

      if (error) {
        console.error('Error fetching roster by ID:', error);
        throw new Error('Failed to fetch roster information. Please try again or contact support.');
      }

      if (!data) {
        return null;
      }

      // Transform the data to match the Roster interface
      return {
        id: data.id,
        employee_id: data.employee_id,
        department_id: data.department_id,
        position: data.position,
        start_date: data.start_date,
        end_date: data.end_date,
        shift_pattern: data.shift_pattern || [],
        notes: data.notes,
        is_active: data.is_active,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by,
        updated_by: data.updated_by,
        assignment_time: data.assignment_time,
        completion_time: data.completion_time
      };
    } catch (error) {
      console.error('Error in getRosterById:', error);
      throw error;
    }
  }

  static async createRoster(roster: Omit<Roster, 'id' | 'created_at' | 'updated_at'>): Promise<Roster> {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) {
        throw new Error('Roster system is not properly initialized. Please contact support.');
      }

    // Ensure shift_pattern is never null by providing a default empty array
    const shiftPattern = roster.shift_pattern || [];

    // If start_date and end_date are provided but shift_pattern is empty,
    // create a default pattern with 'off' shifts for each day
    if (roster.start_date && roster.end_date && shiftPattern.length === 0) {
      const startDate = new Date(roster.start_date);
      const endDate = new Date(roster.end_date);
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        shiftPattern.push({
          date: currentDate.toISOString().split('T')[0],
          shift: 'off'
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const { data, error } = await supabase
      .from('rosters')
      .insert([{
        employee_id: roster.employee_id,
          department_id: roster.department_id || null,
        position: roster.position || 'Unassigned',
        start_date: roster.start_date,
        end_date: roster.end_date,
        shift_pattern: shiftPattern,
        notes: roster.notes,
          is_active: true,
          status: 'active',
        created_by: roster.created_by,
        updated_by: roster.updated_by,
        assignment_time: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }
    
    if (!data) {
      throw new Error('No data returned from roster creation');
    }

    return data;
    } catch (error) {
      console.error('Error in createRoster:', error);
      throw error;
    }
  }

  static async updateRoster(id: string, updates: Partial<Omit<Roster, 'id' | 'created_at'>>): Promise<Roster> {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) {
        throw new Error('Roster system is not properly initialized. Please contact support.');
      }

    // Ensure shift_pattern is never null when updating
    if (updates.shift_pattern === null) {
      updates.shift_pattern = [];
    }

    const { data, error } = await supabase
      .from('rosters')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

      if (error) {
        console.error('Error updating roster:', error);
        throw new Error('Failed to update roster. Please try again or contact support.');
      }

    return data;
    } catch (error) {
      console.error('Error in updateRoster:', error);
      throw error;
    }
  }

  static async deleteRoster(id: string): Promise<void> {
    try {
      const tableExists = await this.checkTableExists();
      if (!tableExists) {
        throw new Error('Roster system is not properly initialized. Please contact support.');
      }

    const { error } = await supabase
      .from('rosters')
      .delete()
      .eq('id', id);

      if (error) {
        console.error('Error deleting roster:', error);
        throw new Error('Failed to delete roster. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Error in deleteRoster:', error);
      throw error;
    }
  }
} 