import React, { useState } from 'react';
import { createGatePass } from '@/utils/gatePassUtils';
import { GatePass } from '@/types';

interface GatePassFormProps {
  onSuccess?: (pass: GatePass) => void;
  onError?: (error: Error) => void;
}

const GatePassForm: React.FC<GatePassFormProps> = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    validity: 'single' as 'single' | 'day' | 'week' | 'month',
    type: 'both' as 'entry' | 'exit' | 'both',
    reason: '',
    expectedExitTime: '',
    expectedReturnTime: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pass = await createGatePass(
        formData.employeeId,
        formData.validity,
        formData.type,
        formData.reason,
        formData.expectedExitTime || undefined,
        formData.expectedReturnTime || undefined
      );

      if (pass) {
        onSuccess?.(pass);
        // Reset form
        setFormData({
          employeeId: '',
          validity: 'single',
          type: 'both',
          reason: '',
          expectedExitTime: '',
          expectedReturnTime: ''
        });
      }
    } catch (error) {
      console.error('Error creating gate pass:', error);
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg mx-auto p-4">
      <div>
        <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
          Employee ID
        </label>
        <input
          type="text"
          id="employeeId"
          name="employeeId"
          value={formData.employeeId}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="validity" className="block text-sm font-medium text-gray-700">
          Validity
        </label>
        <select
          id="validity"
          name="validity"
          value={formData.validity}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="single">Single Use</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
          Pass Type
        </label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="both">Entry & Exit</option>
          <option value="entry">Entry Only</option>
          <option value="exit">Exit Only</option>
        </select>
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
          Reason
        </label>
        <textarea
          id="reason"
          name="reason"
          value={formData.reason}
          onChange={handleChange}
          required
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="expectedExitTime" className="block text-sm font-medium text-gray-700">
          Expected Exit Time
        </label>
        <input
          type="datetime-local"
          id="expectedExitTime"
          name="expectedExitTime"
          value={formData.expectedExitTime}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="expectedReturnTime" className="block text-sm font-medium text-gray-700">
          Expected Return Time
        </label>
        <input
          type="datetime-local"
          id="expectedReturnTime"
          name="expectedReturnTime"
          value={formData.expectedReturnTime}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded-md text-white font-medium ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {loading ? 'Creating...' : 'Create Gate Pass'}
        </button>
      </div>
    </form>
  );
};

export default GatePassForm; 