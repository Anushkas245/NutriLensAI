import { createContext, useContext, useState } from 'react';

const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const [compareIds, setCompareIds] = useState(() => {
    try {
      const saved = localStorage.getItem('nutrilens_compare_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const persist = (next) => {
    setCompareIds(next);
    localStorage.setItem('nutrilens_compare_ids', JSON.stringify(next));
  };

  const toggleCompare = (productId) => {
    const id = Number(productId);
    if (!id) return;
    if (compareIds.includes(id)) {
      persist(compareIds.filter((x) => x !== id));
    } else if (compareIds.length < 4) {
      persist([...compareIds, id]);
    }
  };

  const clearCompare = () => persist([]);

  return (
    <CompareContext.Provider value={{ compareIds, toggleCompare, clearCompare }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}
