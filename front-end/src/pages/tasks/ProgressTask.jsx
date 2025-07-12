import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useCommon } from '../../contexts/CommonContext';
import { Button } from 'react-bootstrap';

const ProgressTask = ({ task, refreshTaskData, isAssignee, isAssigner }) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [checklist, setChecklist] = useState(task.checklist || []);
  const isViewer = !isAssignee && !isAssigner;

  useEffect(() => {
    setChecklist(task.checklist || []);
  }, [task.checklist]);

  const totalItems = checklist.length;
  const doneCount = checklist.filter((i) => i.completed).length;
  const percentDone = totalItems ? Math.round((doneCount / totalItems) * 100) : 0;

  const updateChecklist = async (newList) => {
    try {
      const res = await axios.put(`${apiBaseUrl}/task/updateTask/${task._id}`, { checklist: newList }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setChecklist(newList); 
      await refreshTaskData();
    } catch (err) {
      console.error('Cập nhật checklist thất bại:', err);
      alert('Cập nhật checklist thất bại: ' + (err.response?.data?.message || err.message));
    }
  };

  const updateChecklistItem = async (itemIndex, completed) => {
    try {
      await axios.put(`${apiBaseUrl}/task/${task._id}/checklist`, { itemIndex, completed }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const updatedList = [...checklist];
      updatedList[itemIndex].completed = completed;
      setChecklist(updatedList); 
      await refreshTaskData();
    } catch (err) {
      console.error('Cập nhật checklist item thất bại:', err);
      alert('Cập nhật checklist item thất bại: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggle = (item) => {
    const itemIndex = checklist.findIndex((i) => i._id === item._id);
    if (itemIndex !== -1) updateChecklistItem(itemIndex, !item.completed);
  };

  const handleDelete = (item) => {
    if (window.confirm('Xác nhận xóa mục checklist này?')) {
      const updated = checklist.filter((i) => i._id !== item._id);
      updateChecklist(updated);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Do you wanna remove all assignment?')) {
      updateChecklist([]);
    }
  };

  return (
    <div className='task-modal-section'>
      <label className='section-label'>Progress Task :</label>
      {totalItems ? (
        <>
          <div className='checklist-progress d-flex align-items-center mb-2'>
            <div className='progress flex-grow-1'>
              <div className='progress-bar' role='progressbar' style={{ width: `${percentDone}%` }} />
            </div>
            <span className='ms-2'>{percentDone}%</span>
            {(isAssignee || isAssigner) && (
              <Button variant='outline-danger' size='sm' className='ms-2' onClick={handleClearAll}>
                Clear All
              </Button>
            )}
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <ul className='checklist-list'>
              {checklist.map((item) => (
                <li key={item._id} className='d-flex align-items-center mb-1'>
                  {!isViewer && (
                    <input
                      type='checkbox'
                      className='form-check-input me-2'
                      checked={item.completed}
                      onChange={() => handleToggle(item)}
                    />
                  )}
                  <span style={{ flexGrow: 1, textDecoration: item.completed ? 'line-through' : 'none' }}>
                    {item.title}
                  </span>
                  {(isAssignee || isAssigner) && (
                    <Button variant='link' size='sm' className='text-danger ms-2' onClick={() => handleDelete(item)}>
                      Delete
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p className='text-muted-progressTask'>No Assignment.</p>
      )}
    </div>
  );
};

export default ProgressTask;