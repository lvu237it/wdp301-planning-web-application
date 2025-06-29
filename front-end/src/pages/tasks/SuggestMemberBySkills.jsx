import React, { useState, useEffect } from "react";
import Select from "react-select";
import axios from "axios";
import { useCommon } from "../../contexts/CommonContext";

const SuggestMembersBySkills = ({
  workspaceId,
  boardId,
  onAssignSuccess
}) => {
  const { accessToken, apiBaseUrl } = useCommon();
  const [allSkills, setAllSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);

  // 1) Load toàn bộ skills
  useEffect(() => {
    axios
      .get(`${apiBaseUrl}/skills`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then(res => {
        setAllSkills(
          res.data.skills.map(s => ({ value: s.value, label: s.label }))
        );
      })
      .catch(err => console.error("Error loading skills:", err));
  }, [apiBaseUrl, accessToken]);

  // 2) Gợi ý members theo skills
  const fetchSuggestions = () => {
    const skillsParam = selectedSkills.map(s => s.value).join(",");
    setHasFetched(false);

    axios
      .get(
        `${apiBaseUrl}/workspace/${workspaceId}/board/${boardId}/suggest-members`,
        {
          params: { skills: skillsParam },
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
      .then(res => {
        setSuggestions(res.data.users || []);
        setHasFetched(true);
      })
      .catch(err => {
        console.error("Error fetching suggestions:", err);
        setHasFetched(true);
      });
  };

  return (
    <div>
      <Select
        isMulti
        options={allSkills}
        value={selectedSkills}
        onChange={setSelectedSkills}
        placeholder="Chọn kỹ năng..."
      />
      <button
        className="btn btn-primary mt-2"
        onClick={fetchSuggestions}
        disabled={!selectedSkills.length}
      >
        Gợi ý thành viên
      </button>

      {hasFetched && suggestions.length === 0 && (
        <p className="mt-2 text-muted">Không tìm thấy thành viên phù hợp.</p>
      )}

      {suggestions.length > 0 && (
        <ul className="list-group mt-3">
          {suggestions.map(u => (
            <li
              key={u._id}
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <span>
                <strong>{u.username}</strong> ({u.email})
              </span>
              <button
                className="btn btn-sm btn-success"
                onClick={() => onAssignSuccess(u)}
              >
                Giao task
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SuggestMembersBySkills;


