import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

function BoardCalendar() {
  const { boardId } = useParams();

  useEffect(() => {
    console.log('boardID', boardId);
  }, [boardId]);

  return <div>BoardCalendar</div>;
}

export default BoardCalendar;
