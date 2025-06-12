// src/pages/boards/BoardDetail.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import List from '../lists/List';

const BoardDetail = () => {
  const { boardId } = useParams();
  return (
    <div className="container">
      <h2 className="my-4">Danh sách của Board</h2>
      <List boardId={boardId} />
    </div>
  );
};

export default BoardDetail;
