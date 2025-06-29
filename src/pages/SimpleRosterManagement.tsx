import { useState } from 'react';
import { ShiftType, Roster } from '../integrations/supabase/types';
import { supabase } from '../integrations/supabase/client';

const SHIFT_TYPES: ShiftType[] = ['morning', 'evening', 'night', 'off'];

interface FormValues {
  employee_id: string;
  start_date: string;
  end_date: string;
  shift: ShiftType;
}

export default function SimpleRosterManagement() {
  const [formValues, setFormValues] = useState<FormValues>({
    employee_id: '',
    start_date: '',
    end_date: '',
    shift: 'morning'
  });
  const [rosters, setRosters] = useState<Roster[]>([]);

  const handleCreateRoster = async () => {
    const { data, error } = await supabase
      .from('rosters')
      .insert({
        employee_id: formValues.employee_id,
        start_date: formValues.start_date,
        end_date: formValues.end_date,
        shift: formValues.shift,
        status: 'active'
      })
      .select();

    if (error) {
      console.error('Error creating roster:', error);
      return;
    }

    if (data) {
      const newRoster = {
        ...data[0],
        shift: data[0].shift as ShiftType
      } as Roster;
      setRosters([...rosters, newRoster]);
    }
  };

  const renderShiftCell = (shift: ShiftType) => {
    return (
      <div className="p-2 border">
        {shift}
      </div>
    );
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Simple Roster Management</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Create New Roster</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="employee_id" className="block mb-1">Employee ID</label>
            <input
              id="employee_id"
              type="text"
              value={formValues.employee_id}
              onChange={(e) => setFormValues({ ...formValues, employee_id: e.target.value })}
              className="border p-2 rounded"
              aria-label="Employee ID"
            />
          </div>
          <div>
            <label htmlFor="start_date" className="block mb-1">Start Date</label>
            <input
              id="start_date"
              type="date"
              value={formValues.start_date}
              onChange={(e) => setFormValues({ ...formValues, start_date: e.target.value })}
              className="border p-2 rounded"
              aria-label="Start Date"
            />
          </div>
          <div>
            <label htmlFor="end_date" className="block mb-1">End Date</label>
            <input
              id="end_date"
              type="date"
              value={formValues.end_date}
              onChange={(e) => setFormValues({ ...formValues, end_date: e.target.value })}
              className="border p-2 rounded"
              aria-label="End Date"
            />
          </div>
          <div>
            <label htmlFor="shift" className="block mb-1">Shift</label>
            <select
              id="shift"
              value={formValues.shift}
              onChange={(e) => setFormValues({ ...formValues, shift: e.target.value as ShiftType })}
              className="border p-2 rounded"
              aria-label="Shift"
            >
              {SHIFT_TYPES.map((shift) => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreateRoster}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Create Roster
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Current Rosters</h2>
        <div className="border rounded">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Employee ID</th>
                <th className="p-2 text-left">Start Date</th>
                <th className="p-2 text-left">End Date</th>
                <th className="p-2 text-left">Shift</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rosters.map((roster) => (
                <tr key={roster.id}>
                  <td className="p-2">{roster.employee_id}</td>
                  <td className="p-2">{roster.start_date}</td>
                  <td className="p-2">{roster.end_date}</td>
                  <td className="p-2">{renderShiftCell(roster.shift)}</td>
                  <td className="p-2">{roster.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 