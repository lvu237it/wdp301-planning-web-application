// src/pages/boards/BoardDetail.jsx
import { useParams } from 'react-router-dom';
import React, { useEffect } from 'react';
import List from '../lists/List';
import { useCommon } from '../../contexts/CommonContext';

const BoardDetail = () => {
  const { workspaceId, boardId } = useParams();
  const { setCurrentWorkspaceId, navigate } = useCommon();

  useEffect(() => {
    if (workspaceId) {
      setCurrentWorkspaceId(workspaceId);
    }
  }, [workspaceId, setCurrentWorkspaceId]);

  return (
    <div className='board-detail-page'>
      <div className='board-detail-header'>
        <div className='container d-flex justify-content-between'>
          <h2 className='board-title'>List of boards</h2>
          <div
            className='btn-create-workspace btn btn-success'
            onClick={() => navigate(`/board-calendar/${boardId}`)}
          >
            View on calendar
          </div>
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
