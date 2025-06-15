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
    <div className="container">
      <h2 className="my-4">Danh sách của Board</h2>
      <List boardId={boardId} />
    </div>
  );
};

export default BoardDetail;
