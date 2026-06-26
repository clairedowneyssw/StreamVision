"""StreamVisionAR backend API tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://reality-viewer.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def projects(session):
    r = session.get(f"{API}/projects", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 3
    return data


# --- Project endpoints ---
class TestProjects:
    def test_list_projects(self, projects):
        codes = {p["code"] for p in projects}
        assert {"RVT-B", "NGH", "HLW"}.issubset(codes)
        for p in projects:
            for key in ("id", "name", "location", "code", "sync_state", "progress",
                        "deviation_mm", "open_issues", "layers"):
                assert key in p, f"missing {key}"
            assert isinstance(p["layers"], list) and len(p["layers"]) == 4
            assert {l["key"] for l in p["layers"]} == {"structural", "mep", "electrical", "plumbing"}

    def test_get_project_by_id(self, session, projects):
        pid = projects[0]["id"]
        r = session.get(f"{API}/projects/{pid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_project_404(self, session):
        r = session.get(f"{API}/projects/nonexistent-id", timeout=30)
        assert r.status_code == 404


# --- Issues per project ---
class TestProjectIssues:
    def test_project_issues_list(self, session, projects):
        pid = projects[0]["id"]
        r = session.get(f"{API}/projects/{pid}/issues", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 3
        refs = {i["ref"] for i in data}
        assert {"RFI-104", "WI-088", "NR-051"}.issubset(refs)

    def test_project_activity_list(self, session, projects):
        pid = projects[0]["id"]
        r = session.get(f"{API}/projects/{pid}/activity", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 3


# --- Create / Update issue flow ---
class TestIssueFlow:
    created_id = None
    created_ref = None
    project_id = None
    initial_open = None

    def test_create_issue_bumps_open_and_logs_activity(self, session, projects):
        proj = projects[1]  # NGH
        TestIssueFlow.project_id = proj["id"]
        TestIssueFlow.initial_open = proj["open_issues"]

        # baseline activity count
        ra = session.get(f"{API}/projects/{proj['id']}/activity", timeout=30)
        before_activity = len(ra.json())

        payload = {
            "project_id": proj["id"],
            "title": "TEST_ Field deviation at Grid B2",
            "description": "Auto test issue",
            "tag": "needs_review",
            "location_label": "Level 1 / Grid B2",
            "author": "Tester",
        }
        r = session.post(f"{API}/issues", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        issue = r.json()
        assert issue["ref"].startswith("PL-")
        assert issue["title"] == payload["title"]
        assert issue["status"] == "open"
        TestIssueFlow.created_id = issue["id"]
        TestIssueFlow.created_ref = issue["ref"]

        # GET issue
        rg = session.get(f"{API}/issues/{issue['id']}", timeout=30)
        assert rg.status_code == 200
        assert rg.json()["id"] == issue["id"]

        # open_issues bumped
        rp = session.get(f"{API}/projects/{proj['id']}", timeout=30)
        assert rp.json()["open_issues"] == TestIssueFlow.initial_open + 1

        # activity contains new entry
        ra2 = session.get(f"{API}/projects/{proj['id']}/activity", timeout=30)
        assert len(ra2.json()) == before_activity + 1
        assert any(issue["ref"] in a["message"] for a in ra2.json())

    def test_patch_issue_resolve_recomputes_open(self, session):
        assert TestIssueFlow.created_id, "depends on create"
        r = session.patch(f"{API}/issues/{TestIssueFlow.created_id}",
                          json={"status": "resolved"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "resolved"

        # verify GET reflects status
        rg = session.get(f"{API}/issues/{TestIssueFlow.created_id}", timeout=30)
        assert rg.json()["status"] == "resolved"

        # open_issues should return to baseline
        rp = session.get(f"{API}/projects/{TestIssueFlow.project_id}", timeout=30)
        assert rp.json()["open_issues"] == TestIssueFlow.initial_open

    def test_patch_in_review(self, session, projects):
        # create another for in_review check
        payload = {"project_id": projects[2]["id"], "title": "TEST_ in review item"}
        r = session.post(f"{API}/issues", json=payload, timeout=30)
        assert r.status_code == 200
        iid = r.json()["id"]
        r2 = session.patch(f"{API}/issues/{iid}", json={"status": "in_review"}, timeout=30)
        assert r2.status_code == 200 and r2.json()["status"] == "in_review"

    def test_patch_404(self, session):
        r = session.patch(f"{API}/issues/does-not-exist", json={"status": "resolved"}, timeout=30)
        assert r.status_code == 404

    def test_patch_empty_400(self, session):
        assert TestIssueFlow.created_id
        r = session.patch(f"{API}/issues/{TestIssueFlow.created_id}", json={}, timeout=30)
        assert r.status_code == 400

    def test_create_issue_invalid_project_404(self, session):
        r = session.post(f"{API}/issues", json={"project_id": "nope", "title": "x"}, timeout=30)
        assert r.status_code == 404


# --- Activity comment ---
class TestActivityCreate:
    def test_post_comment(self, session, projects):
        payload = {"project_id": projects[0]["id"], "kind": "comment",
                   "author": "Tester", "message": "TEST_ hello from pytest", "anchor": "Grid A1"}
        r = session.post(f"{API}/activity", json=payload, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["message"] == payload["message"]
        assert body["kind"] == "comment"
        # verify persisted
        rg = session.get(f"{API}/projects/{projects[0]['id']}/activity", timeout=30)
        assert any(a["id"] == body["id"] for a in rg.json())
