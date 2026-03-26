# Implementation Plan: vm-deployment-cicd

## Overview

Implement the unified GitHub Actions CI/CD pipeline by updating `docker-compose.observability.yml` with version variable support and creating `.github/workflows/deploy.yml` as a single workflow that handles full infrastructure provisioning, application deployment, and teardown. The old `terraform.yml` is deleted once `deploy.yml` is in place.

## Tasks

- [x] 1. Pull latest changes from main branch
  - Run `git pull origin main` to ensure the working branch is up to date before making any changes
  - This must be the first step before modifying any files
  - _Requirements: all_

- [x] 2. Update `docker-compose.observability.yml` with version variable support
  - [x] 2.1 Add `image:` tags and `env_file` references to backend and frontend services
    - Add `image: cleo-backend:${BACKEND_VERSION:-latest}` under the `backend` service (alongside existing `build:` block)
    - Add `image: cleo-frontend:${FRONTEND_VERSION:-latest}` under the `frontend` service (alongside existing `build:` block)
    - Add `env_file: - ./backend/.env` under the `backend` service to load runtime env vars from the injected file
    - Add `env_file: - ./frontend/.env.local` under the `frontend` service to load runtime env vars from the injected file
    - Remove hardcoded credential values from the `environment:` block of the backend service (they will come from `backend/.env` at deploy time)
    - _Requirements: 9.4, 9.5, 9.6, 9.7_

  - [ ]* 2.2 Write property test for version variable propagation to image tags
    - **Property 8: Version variables propagate to Docker Compose image tags**
    - Parse the updated `docker-compose.observability.yml` and assert that the backend image tag equals `cleo-backend:${BACKEND_VERSION:-latest}` and frontend equals `cleo-frontend:${FRONTEND_VERSION:-latest}`
    - **Validates: Requirements 9.4, 9.5**

  - [ ]* 2.3 Write property test for all services attached to cleo-network
    - **Property 9: All compose services are attached to cleo-network**
    - Parse `docker-compose.observability.yml` and assert every service entry lists `cleo-network` under its `networks` key
    - **Validates: Requirements 9.9**

- [x] 3. Create `.github/workflows/deploy.yml` — workflow skeleton and inputs
  - Create the file with `name: Deploy CLEO Stack` and `on: workflow_dispatch`
  - Define all nine `workflow_dispatch` inputs: `action` (choice: deploy/destroy), `deploy_target` (choice: all/backend/frontend, default: all), `backend_version` (default: latest), `frontend_version` (default: latest), `backend_env` (string), `frontend_env` (string), `frontend_domain` (default: cleo.andinolabs.ai), `backend_domain` (default: api.andinolabs.ai), `grafana_domain` (default: grafana.andinolabs.ai)
  - Define a single job `deploy` running on `ubuntu-latest` with `env:` block exposing `TF_WORKING_DIR: terraform/env/dev`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 4. Add input validation step to `deploy.yml`
  - Add a step named "Validate JSON inputs" that runs only when `action == 'deploy'`
  - Use `jq` to parse `backend_env` and `frontend_env`; on parse failure print a descriptive error identifying which input is invalid and `exit 1`
  - Add a step named "Validate deploy_target for new VM" that checks: if `deploy_target != 'all'` and VM does not yet exist, fail with `"Error: deploy_target must be 'all' for the first deploy. VM does not exist yet."`
  - _Requirements: 1.11, 1.12_

  - [ ]* 4.1 Write property test for invalid JSON rejection before remote operations
    - **Property 1: Invalid JSON inputs are rejected before remote operations**
    - Generate arbitrary non-JSON strings for `backend_env` and `frontend_env`; assert the validation step exits non-zero and no SSH or Terraform commands are invoked
    - **Validates: Requirements 1.11**

- [x] 5. Add Azure login and Terraform init steps to `deploy.yml`
  - Add `azure/login@v2` step using `${{ secrets.AZURE_CREDENTIALS }}`
  - Add `hashicorp/setup-terraform@v3` step
  - Add `terraform init` step in `${{ env.TF_WORKING_DIR }}` with backend config: `storage_account_name=vanguardtfstate`, `container_name=tfstate`, `key=vanguard.terraform.tfstate`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. Add VM existence check and first-deploy provisioning path to `deploy.yml`
  - Add step "Check VM existence" that runs `terraform output -raw vm_public_ip` and captures the result; set step output `vm_exists=true/false` and `vm_ip=<ip>`
  - Add step "Terraform plan" (runs only when `vm_exists == 'false'`) that executes `terraform plan -out=tfplan.binary` with `TF_VAR_postgres_password=${{ secrets.POSTGRES_PASSWORD }}`
  - Add step "Trivy scan" (runs only when `vm_exists == 'false'`) that converts the plan to JSON and runs `trivy config` for HIGH/CRITICAL findings
  - Add step "Terraform apply" (runs only when `vm_exists == 'false'`) that runs `terraform apply -auto-approve tfplan.binary` and captures `vm_public_ip` and `ssh_private_key` outputs
  - Add step "Save SSH key as GitHub secret" (runs only on first deploy) that uses `GH_PAT` to call `PUT /repos/{owner}/{repo}/actions/secrets/VM_SSH_PRIVATE_KEY` with the key encrypted via libsodium
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 13.4, 13.5_

  - [ ]* 6.1 Write property test for VM existence check determining deploy path
    - **Property 2: VM existence check determines deploy path**
    - Simulate `terraform output` returning empty string vs. valid IP; assert provisioning steps are skipped when IP is non-empty and executed when empty
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [x] 7. Add SSH key setup and cloud-init wait steps to `deploy.yml`
  - Add step "Setup SSH key" that writes the private key to `/tmp/vm_key.pem` with `chmod 600`; for first deploy use the Terraform output, for re-deploy use `${{ secrets.VM_SSH_PRIVATE_KEY }}`; mask the key value with `::add-mask::`
  - Add step "Wait for cloud-init" (runs only when `vm_exists == 'false'`) that polls via SSH every 30 seconds for `/var/log/cloud-init-complete.log`, times out after 10 minutes with a descriptive error, then verifies `docker` is available
  - Add step "Cleanup SSH key" with `if: always()` that runs `rm -f /tmp/vm_key.pem`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 13.6_

  - [ ]* 7.1 Write property test for SSH key always cleaned up from runner
    - **Property 3: SSH key is always cleaned up from runner**
    - Simulate both success and failure job outcomes; assert `/tmp/vm_key.pem` does not exist after the job completes in either case
    - **Validates: Requirements 5.4**

- [x] 8. Add repository sync step to `deploy.yml`
  - Add step "Sync repository to VM" that SSHs into the VM and: if `~/cleo` does not exist, runs `git clone <repo_url> ~/cleo`; if it exists, runs `git -C ~/cleo fetch origin && git -C ~/cleo reset --hard origin/main`
  - Verify `docker-compose.observability.yml` is present in `~/cleo` after sync
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Add environment variable injection step to `deploy.yml`
  - Add step "Inject backend env file" that SSHs into the VM and writes `backend_env` JSON to `~/cleo/backend/.env` using `jq -r 'to_entries[] | "\(.key)=\(.value)"'`, then sets `chmod 600 ~/cleo/backend/.env`
  - Add step "Inject frontend env file" that SSHs into the VM and writes `frontend_env` JSON to `~/cleo/frontend/.env.local` using the same `jq` transformation, then sets `chmod 600 ~/cleo/frontend/.env.local`
  - Both steps run on every deploy regardless of `deploy_target`
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 9.1 Write property test for JSON env round-trip to KEY=VALUE format
    - **Property 4: JSON env inputs round-trip to KEY=VALUE format**
    - Generate arbitrary JSON objects; assert every key-value pair appears as a `KEY=VALUE` line in the output and no extra lines are present
    - **Validates: Requirements 7.1, 7.2**

- [x] 10. Add NGINX installation and configuration steps to `deploy.yml` (deploy_target=all only)
  - Add step "Install NGINX" (runs only when `deploy_target == 'all'`) that SSHs and runs `which nginx || sudo apt-get install -y nginx`
  - Add step "Generate and apply NGINX config" (runs only when `deploy_target == 'all'`) that generates a heredoc config on the runner with three `server` blocks:
    - `frontend_domain` → `proxy_pass http://localhost:3000` with `proxy_http_version 1.1`, `Upgrade`, `Connection` headers
    - `backend_domain` → `proxy_pass http://localhost:8000` with `proxy_http_version 1.1`, `Upgrade`, `Connection` headers, `proxy_buffering off`
    - `grafana_domain` → `proxy_pass http://localhost:3002`
    - All blocks include `proxy_set_header Host`, `X-Real-IP`, `X-Forwarded-For`
  - SCPs or SSHs the config to `/etc/nginx/sites-available/cleo`, creates symlink at `/etc/nginx/sites-enabled/cleo`
  - Runs `sudo nginx -t`; if it fails, print error and `exit 1` without reloading
  - Runs `sudo systemctl reload nginx` only when `nginx -t` passes
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12_

  - [ ]* 10.1 Write property test for NGINX config proxy blocks for all domains
    - **Property 5: NGINX config contains correct proxy blocks for all domains**
    - Generate arbitrary domain triples; assert the generated config contains exactly three `server` blocks each with the correct `proxy_pass` target
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [ ]* 10.2 Write property test for NGINX config required proxy headers
    - **Property 6: NGINX config contains all required proxy headers**
    - Generate arbitrary domain triples; assert all required headers are present in each `location` block per the spec
    - **Validates: Requirements 8.5, 8.6, 8.7, 8.8**

  - [ ]* 10.3 Write property test for invalid NGINX config never triggering reload
    - **Property 7: Invalid NGINX config never triggers reload**
    - Simulate `nginx -t` returning non-zero; assert `systemctl reload nginx` is never called
    - **Validates: Requirements 8.11**

- [x] 11. Add Docker Compose up and health check steps to `deploy.yml`
  - Add step "Docker Compose up" that SSHs into the VM and runs the appropriate command based on `deploy_target`:
    - `all`: `BACKEND_VERSION=<ver> FRONTEND_VERSION=<ver> docker compose -f docker-compose.observability.yml up --build --no-cache -d`
    - `backend`: same command with `backend` appended
    - `frontend`: same command with `frontend` appended
  - Add step "Health check — backend" (runs when `deploy_target` is `all` or `backend`) that polls `http://localhost:8000/health` via SSH with a 60-second timeout; on failure, prints `docker compose logs backend` and exits non-zero
  - Add step "Health check — frontend" (runs when `deploy_target` is `all` or `frontend`) that checks port 3000 is reachable; on failure, prints `docker compose logs frontend` and exits non-zero
  - Add step "Health check — grafana" (runs when `deploy_target` is `all`) that checks port 3002 is reachable; on failure, prints `docker compose logs grafana` and exits non-zero
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8, 9.10, 9.11, 9.12, 9.13, 9.14_

  - [ ]* 11.1 Write property test for health check failure triggering log output and non-zero exit
    - **Property 10: Health check failure triggers log output and non-zero exit**
    - Simulate health check failure for each service; assert Docker Compose logs are printed for the failing service and exit code is non-zero
    - **Validates: Requirements 9.14**

- [x] 12. Add job summary output step to `deploy.yml`
  - Add step "Write job summary" (runs on successful deploy) that appends to `$GITHUB_STEP_SUMMARY`:
    - Action, deploy target, VM public IP, backend version, frontend version
    - DNS records section listing all three domains mapped to the VM IP
  - Ensure no secret values are written to the summary
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 13.7_

  - [ ]* 12.1 Write property test for job summary containing all domain-to-IP mappings
    - **Property 11: Job summary contains all domain-to-IP mappings**
    - Generate arbitrary domain triples and a VM IP; assert all three domains and the IP appear in the summary output
    - **Validates: Requirements 10.3**

  - [ ]* 12.2 Write property test for secrets never appearing in job summary
    - **Property 14: Secrets never appear in job summary output**
    - Generate arbitrary secret values; assert none appear as plaintext in the summary output
    - **Validates: Requirements 13.6, 13.7**

- [ ] 13. Checkpoint — verify deploy path end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Add destroy path steps to `deploy.yml`
  - Add step "Get VM IP for destroy" that runs `terraform output -raw vm_public_ip` and captures the IP; if empty, skip SSH teardown
  - Add step "SSH app teardown" (runs when `action == 'destroy'`) with `continue-on-error: true` that SSHs into the VM and:
    - Runs `docker compose -f docker-compose.observability.yml down --volumes --remove-orphans` from `~/cleo`
    - Removes `/etc/nginx/sites-enabled/cleo` and `/etc/nginx/sites-available/cleo` (using `rm -f` to skip gracefully if absent)
    - Reloads NGINX: `sudo systemctl reload nginx`
    - Removes `~/cleo/backend/.env` and `~/cleo/frontend/.env.local` (using `rm -f`)
  - If SSH fails, log a warning and continue to Terraform destroy
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [ ]* 14.1 Write property test for destroy idempotency with missing resources
    - **Property 12: Destroy is idempotent for missing resources**
    - Simulate missing NGINX config and env files on the VM; assert the destroy step completes with exit code 0 and proceeds to `terraform destroy`
    - **Validates: Requirements 11.6, 11.7**

  - [ ]* 14.2 Write property test for SSH failure not blocking terraform destroy
    - **Property 13: SSH failure during destroy does not block terraform destroy**
    - Simulate SSH connection failure during destroy; assert `terraform destroy -auto-approve` is still executed
    - **Validates: Requirements 11.8**

- [x] 15. Add Terraform destroy step to `deploy.yml`
  - Add step "Terraform destroy" (runs when `action == 'destroy'`) that runs `terraform destroy -auto-approve` with `TF_VAR_postgres_password=${{ secrets.POSTGRES_PASSWORD }}`
  - Add step "Write destroy summary" that appends a confirmation message to `$GITHUB_STEP_SUMMARY` on success, or lists undeleted resources on failure
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 16. Delete the old `terraform.yml` workflow file
  - Delete `.github/workflows/terraform.yml` now that `deploy.yml` covers the full lifecycle
  - Optionally archive `.github/workflows/terraform copy.yml` if it is no longer needed
  - _Requirements: design decision — single unified workflow_

- [ ] 17. Final checkpoint — verify full workflow file and compose changes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
