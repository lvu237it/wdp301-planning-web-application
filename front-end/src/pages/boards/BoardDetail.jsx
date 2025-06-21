// src/pages/boards/BoardDetail.jsx
import { useParams } from 'react-router-dom';
import React, { useEffect } from 'react';
import List from '../lists/List';
import { useCommon } from '../../contexts/CommonContext';

const BoardDetail = () => {
  const { workspaceId, boardId } = useParams();
  const { setCurrentWorkspaceId } = useCommon();

  useEffect(() => {
    if (workspaceId) {
      setCurrentWorkspaceId(workspaceId);
    }
  }, [workspaceId, setCurrentWorkspaceId]);

  return (
    <div className='board-detail-page'>
      <div className='board-detail-header'>
        <div className='container'>
          <h2 className='board-title'>Danh sách của Board</h2>
        </div>
      </div>

      <div className='board-detail-content'>
        <div className='board-lists-container'>
          <List boardId={boardId} />
        </div>
      </div>
    </div>
  );
};

export default BoardDetail;
