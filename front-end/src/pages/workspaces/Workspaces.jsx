import React, { useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Badge,
  Image,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { MdPeople, MdDashboard } from 'react-icons/md';
import { useCommon } from '../../contexts/CommonContext';
import { useNavigate } from 'react-router-dom';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import UpdateWorkspaceModal from './UpdateWorkspaceModal';
import InviteMemberModal from './InviteMemberWorkspace';
import { FaTrash } from 'react-icons/fa';

const Workspaces = () => {
  const {
    workspaces,
    loadingWorkspaces,
    workspacesError,
    setCurrentWorkspaceId,
    closeWorkspace,
    deleteWorkspace,
    toast,
  } = useCommon();
  const navigate = useNavigate();
  const stored = localStorage.getItem('userData');
  const currentUserId = stored ? JSON.parse(stored)._id : null;
  const [showCreate, setShowCreate] = useState(false);
  const [editingWs, setEditingWs] = useState(null);
  const [inviteWsId, setInviteWsId] = useState(null);

  const handleClose = async (e, wsId) => {
    e.stopPropagation();
    if (!window.confirm('Do you want to close this workspace?')) return;
    try {
      await closeWorkspace(wsId);
    } catch (err) {
      toast.error(err.message || 'Close workspace failed');
    }
  };

  const handleDelete = async (e, wsId) => {
    e.stopPropagation();
    if (!window.confirm('Do you want to delete this workspace forever?'))
      return;
    try {
      await deleteWorkspace(wsId);
    } catch (err) {
      toast.error(err.message || 'Delete workspace failed');
    }
  };

  if (loadingWorkspaces) {
    return (
      <div className='workspace-loading'>
        <Spinner animation='border' role='status' />
      </div>
    );
  }

  if (workspacesError) {
    return (
      <div className='workspace-error'>
        <Alert variant='danger'>Error: {workspacesError}</Alert>
      </div>
    );
  }

  return (
    <div className='workspace-page'>
      <div className='workspace-header'>
        <div className='container'>
          <div className='workspace-header-content'>
            <h1 className='workspace-title'>My Workspaces</h1>
            <Button
              variant='success'
              className='btn-create-workspace'
              onClick={() => setShowCreate(true)}
            >
              + New Workspace
            </Button>
          </div>
        </div>
      </div>

      <div className='workspace-content'>
        <Container className='py-4'>
          {/* Modal create */}
          <CreateWorkspaceModal
            show={showCreate}
            onHide={() => setShowCreate(false)}
          />

          {/* Modal edit */}
          {editingWs && (
            <UpdateWorkspaceModal
              show={!!editingWs}
              workspace={editingWs}
              onHide={() => setEditingWs(null)}
            />
          )}

          {/* Modal invite */}
          {inviteWsId && (
            <InviteMemberModal
              show={!!inviteWsId}
              workspaceId={inviteWsId}
              onHide={() => setInviteWsId(null)}
            />
          )}

          {workspaces.length === 0 && (
            <Alert variant='info' className='workspace-empty-alert'>
              Bạn chưa có workspace nào. Hãy tạo mới ngay!
            </Alert>
          )}

          <Row xs={1} md={2} lg={3} className='g-4'>
            {workspaces.map((ws) => {
              // Chuẩn bị data
              const members = Array.isArray(ws.members) ? ws.members : [];
              const totalMembers = members.length;
              const displayMembers = members.slice(0, 3);
              const moreCount = totalMembers > 3 ? totalMembers - 3 : 0;
              const boardCount = ws.countBoard ?? 0;
              const creatorId = ws.creator?._id || ws.creator;
              const currentUserId = JSON.parse(
                localStorage.getItem('userData')
              )._id;
              const isCreator = String(creatorId) === String(currentUserId);

              return (
                <Col key={ws._id}>
                  <Card
                    className='workspace-card h-100 d-flex flex-column'
                    onClick={() => {
                      setCurrentWorkspaceId(ws._id);
                      navigate(`/workspace/${ws._id}/boards`);
                    }}
                  >
                    {/* HEADER */}
                    <Card.Header className='workspace-card-header'>
                      <div className='workspace-card-title-section'>
                        <Card.Title className='workspace-card-title'>
                          {ws.name}
                        </Card.Title>
                      </div>

                      <div className='workspace-card-badge-section'>
                        <Badge
                          pill
                          className={`workspace-badge ${
                            isCreator ? 'creator' : 'member'
                          }`}
                        >
                          {isCreator ? 'Creator' : 'Member'}
                        </Badge>
                        {isCreator && (
                          <FaTrash
                            className='workspace-delete-btn'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(e, ws._id);
                            }}
                          />
                        )}
                      </div>
                    </Card.Header>

                    {/* BODY */}
                    <Card.Body className='workspace-card-body flex-grow-1 d-flex flex-column'>
                      {ws.description && (
                        <Card.Text className='workspace-description'>
                          {ws.description}
                        </Card.Text>
                      )}

                      <div className='workspace-stats'>
                        <div className='workspace-stat-item'>
                          <MdPeople className='workspace-stat-icon' />
                          <span>{totalMembers} Members</span>
                        </div>
                        <div className='workspace-stat-item'>
                          <MdDashboard className='workspace-stat-icon' />
                          <span>{boardCount} Boards</span>
                        </div>
                      </div>

                      <div className='workspace-members'>
                        {displayMembers.map((m, idx) => {
                          const user = m.userId || m;
                          const avatar = user.avatar;
                          const initial = (user.username || '')
                            .charAt(0)
                            .toUpperCase();
                          return avatar ? (
                            <Image
                              key={idx}
                              src={avatar}
                              className='workspace-member-avatar'
                            />
                          ) : (
                            <div
                              key={idx}
                              className='workspace-member-avatar-placeholder'
                            >
                              {initial}
                            </div>
                          );
                        })}
                        {moreCount > 0 && (
                          <div className='workspace-member-more'>
                            +{moreCount}
                          </div>
                        )}
                      </div>
                    </Card.Body>

                    {/* FOOTER */}
                    <Card.Footer className='workspace-card-footer'>
                      <Button
                        variant='outline-primary'
                        className='workspace-action-btn'
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWs(ws);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant='outline-danger'
                        className='workspace-action-btn'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClose(e, ws._id);
                        }}
                      >
                        Close
                      </Button>
                      <Button
                        variant='outline-secondary'
                        className='workspace-action-btn'
                        onClick={(e) => {
                          e.stopPropagation();
                          setInviteWsId(ws._id);
                        }}
                      >
                        Invite
                      </Button>
                    </Card.Footer>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default Workspaces;
