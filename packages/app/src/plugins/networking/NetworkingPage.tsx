import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Page, Header, Content } from '@backstage/core-components';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import Chip from '@material-ui/core/Chip';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import IconButton from '@material-ui/core/IconButton';
import DeleteIcon from '@material-ui/icons/Delete';
import { useTenant } from '../tenantSwitcher/TenantContext';
import { NetworkingApi } from './api';
import type {
  ResourceGroup,
  Nsg,
  NsgRule,
  RuleInput,
  DeployTarget,
  ServiceDeployment,
  DeploymentInput,
} from './types';

const STATUS_COLOR: Record<string, string> = {
  active: '#16a34a',
  pending: '#d97706',
  failed: '#dc2626',
  deleting: '#64748b',
};

const StatusChip = ({ status, error }: { status: string; error?: string | null }) => (
  <Chip
    size="small"
    label={status}
    title={error ?? undefined}
    style={{
      color: '#ffffff',
      background: STATUS_COLOR[status] ?? '#64748b',
      textTransform: 'capitalize',
    }}
  />
);

const sectionStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '1rem 1.25rem',
  marginBottom: '1.25rem',
};

const initialRule: RuleInput = {
  name: '',
  priority: 100,
  direction: 'inbound',
  access: 'allow',
  protocol: 'tcp',
  sourceAddressPrefix: '*',
  sourcePortRange: '*',
  destinationAddressPrefix: '*',
  destinationPortRange: '443',
};

/**
 * Manages Resource Groups and NSGs for the currently-selected tenant (via
 * the sidebar's TenantSwitcher) — the same model regardless of whether
 * the tenant deploys to Azure (real ARM resources) or on-prem (a stub
 * today, pending the orchestrator API contract).
 */
export const NetworkingPage = () => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const api = useMemo(() => new NetworkingApi(discoveryApi, fetchApi), [discoveryApi, fetchApi]);
  const { currentTenant, loading: tenantLoading } = useTenant();

  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [newRgName, setNewRgName] = useState('');
  const [newRgDescription, setNewRgDescription] = useState('');
  const [newRgTarget, setNewRgTarget] = useState<DeployTarget | ''>('');
  const [creatingRg, setCreatingRg] = useState(false);
  const [rgError, setRgError] = useState<string | null>(null);

  const [selectedRgId, setSelectedRgId] = useState<string | undefined>();
  const [nsgs, setNsgs] = useState<Nsg[]>([]);
  const [loadingNsgs, setLoadingNsgs] = useState(false);
  const [newNsgName, setNewNsgName] = useState('');
  const [creatingNsg, setCreatingNsg] = useState(false);
  const [nsgError, setNsgError] = useState<string | null>(null);

  const [deployments, setDeployments] = useState<ServiceDeployment[]>([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [newDeployment, setNewDeployment] = useState<DeploymentInput>({
    name: '',
    vmSize: 'Standard_B2s',
    adminUsername: 'azureuser',
    adminPassword: '',
    nsgId: undefined,
  });
  const [creatingDeployment, setCreatingDeployment] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const [selectedNsgId, setSelectedNsgId] = useState<string | undefined>();
  const [rules, setRules] = useState<NsgRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [newRule, setNewRule] = useState<RuleInput>(initialRule);
  const [creatingRule, setCreatingRule] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const reloadResourceGroups = async (tenantId: string) => {
    setLoadingGroups(true);
    try {
      setResourceGroups(await api.listResourceGroups(tenantId));
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    setSelectedRgId(undefined);
    setSelectedNsgId(undefined);
    if (currentTenant) {
      reloadResourceGroups(currentTenant.tenantId);
    } else {
      setResourceGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.tenantId]);

  const reloadNsgs = async (rgId: string) => {
    setLoadingNsgs(true);
    try {
      setNsgs(await api.listNsgs(rgId));
    } finally {
      setLoadingNsgs(false);
    }
  };

  const reloadDeployments = async (rgId: string) => {
    setLoadingDeployments(true);
    try {
      setDeployments(await api.listDeployments(rgId));
    } finally {
      setLoadingDeployments(false);
    }
  };

  useEffect(() => {
    setSelectedNsgId(undefined);
    if (selectedRgId) {
      reloadNsgs(selectedRgId);
      reloadDeployments(selectedRgId);
    } else {
      setNsgs([]);
      setDeployments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRgId]);

  const reloadRules = async (nsgId: string) => {
    setLoadingRules(true);
    try {
      setRules(await api.listRules(nsgId));
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    if (selectedNsgId) {
      reloadRules(selectedNsgId);
    } else {
      setRules([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNsgId]);

  const handleCreateResourceGroup = async () => {
    if (!currentTenant || !newRgName || !newRgTarget) return;
    setCreatingRg(true);
    setRgError(null);
    try {
      await api.createResourceGroup(currentTenant.tenantId, {
        name: newRgName,
        description: newRgDescription || undefined,
        target: newRgTarget,
      });
      setNewRgName('');
      setNewRgDescription('');
      setNewRgTarget('');
      await reloadResourceGroups(currentTenant.tenantId);
    } catch (err) {
      setRgError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingRg(false);
    }
  };

  const handleDeleteResourceGroup = async (id: string) => {
    if (!currentTenant) return;
    await api.deleteResourceGroup(id);
    if (selectedRgId === id) setSelectedRgId(undefined);
    await reloadResourceGroups(currentTenant.tenantId);
  };

  const handleCreateNsg = async () => {
    if (!selectedRgId || !newNsgName) return;
    setCreatingNsg(true);
    setNsgError(null);
    try {
      await api.createNsg(selectedRgId, newNsgName);
      setNewNsgName('');
      await reloadNsgs(selectedRgId);
    } catch (err) {
      setNsgError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingNsg(false);
    }
  };

  const handleDeleteNsg = async (id: string) => {
    if (!selectedRgId) return;
    await api.deleteNsg(id);
    if (selectedNsgId === id) setSelectedNsgId(undefined);
    await reloadNsgs(selectedRgId);
  };

  const handleCreateDeployment = async () => {
    if (!selectedRgId || !newDeployment.name || !newDeployment.adminPassword) return;
    setCreatingDeployment(true);
    setDeploymentError(null);
    try {
      await api.createDeployment(selectedRgId, newDeployment);
      setNewDeployment({ ...newDeployment, name: '', adminPassword: '' });
      await reloadDeployments(selectedRgId);
    } catch (err) {
      setDeploymentError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingDeployment(false);
    }
  };

  const handleDeleteDeployment = async (id: string) => {
    if (!selectedRgId) return;
    await api.deleteDeployment(id);
    await reloadDeployments(selectedRgId);
  };

  const handleCreateRule = async () => {
    if (!selectedNsgId || !newRule.name) return;
    setCreatingRule(true);
    setRuleError(null);
    try {
      await api.createRule(selectedNsgId, newRule);
      setNewRule({ ...initialRule, priority: newRule.priority + 10 });
      await reloadRules(selectedNsgId);
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!selectedNsgId) return;
    await api.deleteRule(id);
    await reloadRules(selectedNsgId);
  };

  const selectedRg = resourceGroups.find(rg => rg.id === selectedRgId);
  const selectedNsg = nsgs.find(n => n.id === selectedNsgId);

  return (
    <Page themeId="tool">
      <Header
        title="Networking"
        subtitle="Resource Groups and Network Security Groups — the same model on-prem and Azure"
      />
      <Content>
        {tenantLoading ? (
          <Typography>Loading tenants…</Typography>
        ) : !currentTenant ? (
          <Typography color="textSecondary">
            You don't have access to any tenants. Networking is scoped per tenant — see the
            switcher in the sidebar.
          </Typography>
        ) : (
          <>
            <div style={sectionStyle}>
              <Typography variant="h6" gutterBottom>
                Resource Groups — {currentTenant.name}
              </Typography>

              {loadingGroups ? (
                <Typography>Loading…</Typography>
              ) : resourceGroups.length === 0 ? (
                <Typography color="textSecondary" style={{ marginBottom: '1rem' }}>
                  No resource groups yet.
                </Typography>
              ) : (
                <Table size="small" style={{ marginBottom: '1rem' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Target</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resourceGroups.map(rg => (
                      <TableRow
                        key={rg.id}
                        hover
                        selected={rg.id === selectedRgId}
                        onClick={() => setSelectedRgId(rg.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell>{rg.name}</TableCell>
                        <TableCell style={{ textTransform: 'capitalize' }}>{rg.target}</TableCell>
                        <TableCell>
                          <StatusChip status={rg.status} error={rg.error} />
                        </TableCell>
                        <TableCell>{rg.description}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteResourceGroup(rg.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <TextField
                  label="Name"
                  size="small"
                  value={newRgName}
                  onChange={e => setNewRgName(e.target.value)}
                />
                <TextField
                  label="Description"
                  size="small"
                  value={newRgDescription}
                  onChange={e => setNewRgDescription(e.target.value)}
                />
                <TextField
                  select
                  label="Target"
                  size="small"
                  style={{ minWidth: 120 }}
                  value={newRgTarget}
                  onChange={e => setNewRgTarget(e.target.value as DeployTarget)}
                >
                  {currentTenant.hasAzure && <MenuItem value="azure">Azure</MenuItem>}
                  {currentTenant.hasOnPrem && <MenuItem value="onprem">On-Prem</MenuItem>}
                </TextField>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={creatingRg || !newRgName || !newRgTarget}
                  onClick={handleCreateResourceGroup}
                >
                  {creatingRg ? 'Creating…' : 'Create Resource Group'}
                </Button>
              </div>
              {rgError && (
                <Typography color="error" variant="body2" style={{ marginTop: '0.5rem' }}>
                  {rgError}
                </Typography>
              )}
            </div>

            {selectedRg && (
              <div style={sectionStyle}>
                <Typography variant="h6" gutterBottom>
                  NSGs — {selectedRg.name}
                </Typography>

                {loadingNsgs ? (
                  <Typography>Loading…</Typography>
                ) : nsgs.length === 0 ? (
                  <Typography color="textSecondary" style={{ marginBottom: '1rem' }}>
                    No NSGs yet.
                  </Typography>
                ) : (
                  <Table size="small" style={{ marginBottom: '1rem' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {nsgs.map(nsg => (
                        <TableRow
                          key={nsg.id}
                          hover
                          selected={nsg.id === selectedNsgId}
                          onClick={() => setSelectedNsgId(nsg.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <TableCell>{nsg.name}</TableCell>
                          <TableCell>
                            <StatusChip status={nsg.status} error={nsg.error} />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteNsg(nsg.id);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <TextField
                    label="Name"
                    size="small"
                    value={newNsgName}
                    onChange={e => setNewNsgName(e.target.value)}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={creatingNsg || !newNsgName}
                    onClick={handleCreateNsg}
                  >
                    {creatingNsg ? 'Creating…' : 'Create NSG'}
                  </Button>
                </div>
                {nsgError && (
                  <Typography color="error" variant="body2" style={{ marginTop: '0.5rem' }}>
                    {nsgError}
                  </Typography>
                )}
              </div>
            )}

            {selectedRg && (
              <div style={sectionStyle}>
                <Typography variant="h6" gutterBottom>
                  Deployments — {selectedRg.name}
                </Typography>

                {loadingDeployments ? (
                  <Typography>Loading…</Typography>
                ) : deployments.length === 0 ? (
                  <Typography color="textSecondary" style={{ marginBottom: '1rem' }}>
                    Nothing deployed into this resource group yet.
                  </Typography>
                ) : (
                  <Table size="small" style={{ marginBottom: '1rem' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {deployments.map(dep => (
                        <TableRow key={dep.id}>
                          <TableCell>{dep.name}</TableCell>
                          <TableCell>{dep.vm_size}</TableCell>
                          <TableCell>
                            <StatusChip status={dep.status} error={dep.error} />
                          </TableCell>
                          <TableCell>
                            {dep.console_url && (
                              <a href={dep.console_url} target="_blank" rel="noreferrer">
                                Open in Console
                              </a>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => handleDeleteDeployment(dep.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <TextField
                    label="Name"
                    size="small"
                    value={newDeployment.name}
                    onChange={e => setNewDeployment({ ...newDeployment, name: e.target.value })}
                  />
                  <TextField
                    label="VM Size"
                    size="small"
                    value={newDeployment.vmSize}
                    onChange={e => setNewDeployment({ ...newDeployment, vmSize: e.target.value })}
                  />
                  <TextField
                    label="Admin Username"
                    size="small"
                    value={newDeployment.adminUsername}
                    onChange={e =>
                      setNewDeployment({ ...newDeployment, adminUsername: e.target.value })
                    }
                  />
                  <TextField
                    label="Admin Password"
                    type="password"
                    size="small"
                    value={newDeployment.adminPassword}
                    onChange={e =>
                      setNewDeployment({ ...newDeployment, adminPassword: e.target.value })
                    }
                  />
                  <TextField
                    select
                    label="NSG"
                    size="small"
                    style={{ minWidth: 140 }}
                    value={newDeployment.nsgId ?? ''}
                    onChange={e =>
                      setNewDeployment({ ...newDeployment, nsgId: e.target.value || undefined })
                    }
                  >
                    <MenuItem value="">None</MenuItem>
                    {nsgs
                      .filter(nsg => nsg.status === 'active')
                      .map(nsg => (
                        <MenuItem key={nsg.id} value={nsg.id}>
                          {nsg.name}
                        </MenuItem>
                      ))}
                  </TextField>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={creatingDeployment || !newDeployment.name || !newDeployment.adminPassword}
                    onClick={handleCreateDeployment}
                  >
                    {creatingDeployment ? 'Deploying…' : 'Deploy'}
                  </Button>
                </div>
                {deploymentError && (
                  <Typography color="error" variant="body2" style={{ marginTop: '0.5rem' }}>
                    {deploymentError}
                  </Typography>
                )}
              </div>
            )}

            {selectedNsg && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Rules — {selectedNsg.name}
                  </Typography>

                  {loadingRules ? (
                    <Typography>Loading…</Typography>
                  ) : rules.length === 0 ? (
                    <Typography color="textSecondary" style={{ marginBottom: '1rem' }}>
                      No rules yet — all traffic follows the platform default.
                    </Typography>
                  ) : (
                    <Table size="small" style={{ marginBottom: '1rem' }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Priority</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Direction</TableCell>
                          <TableCell>Access</TableCell>
                          <TableCell>Protocol</TableCell>
                          <TableCell>Source</TableCell>
                          <TableCell>Destination</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rules.map(rule => (
                          <TableRow key={rule.id}>
                            <TableCell>{rule.priority}</TableCell>
                            <TableCell>{rule.name}</TableCell>
                            <TableCell style={{ textTransform: 'capitalize' }}>
                              {rule.direction}
                            </TableCell>
                            <TableCell style={{ textTransform: 'capitalize' }}>
                              {rule.access}
                            </TableCell>
                            <TableCell style={{ textTransform: 'uppercase' }}>
                              {rule.protocol}
                            </TableCell>
                            <TableCell>
                              {rule.source_address_prefix}:{rule.source_port_range}
                            </TableCell>
                            <TableCell>
                              {rule.destination_address_prefix}:{rule.destination_port_range}
                            </TableCell>
                            <TableCell>
                              <StatusChip status={rule.status} error={rule.error} />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" onClick={() => handleDeleteRule(rule.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <TextField
                      label="Name"
                      size="small"
                      value={newRule.name}
                      onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                    />
                    <TextField
                      label="Priority"
                      type="number"
                      size="small"
                      style={{ width: 90 }}
                      value={newRule.priority}
                      onChange={e => setNewRule({ ...newRule, priority: Number(e.target.value) })}
                    />
                    <TextField
                      select
                      label="Direction"
                      size="small"
                      style={{ minWidth: 110 }}
                      value={newRule.direction}
                      onChange={e =>
                        setNewRule({ ...newRule, direction: e.target.value as RuleInput['direction'] })
                      }
                    >
                      <MenuItem value="inbound">Inbound</MenuItem>
                      <MenuItem value="outbound">Outbound</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="Access"
                      size="small"
                      style={{ minWidth: 90 }}
                      value={newRule.access}
                      onChange={e =>
                        setNewRule({ ...newRule, access: e.target.value as RuleInput['access'] })
                      }
                    >
                      <MenuItem value="allow">Allow</MenuItem>
                      <MenuItem value="deny">Deny</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="Protocol"
                      size="small"
                      style={{ minWidth: 90 }}
                      value={newRule.protocol}
                      onChange={e =>
                        setNewRule({ ...newRule, protocol: e.target.value as RuleInput['protocol'] })
                      }
                    >
                      <MenuItem value="tcp">TCP</MenuItem>
                      <MenuItem value="udp">UDP</MenuItem>
                      <MenuItem value="*">Any</MenuItem>
                    </TextField>
                    <TextField
                      label="Source addr"
                      size="small"
                      value={newRule.sourceAddressPrefix}
                      onChange={e => setNewRule({ ...newRule, sourceAddressPrefix: e.target.value })}
                    />
                    <TextField
                      label="Source port"
                      size="small"
                      style={{ width: 90 }}
                      value={newRule.sourcePortRange}
                      onChange={e => setNewRule({ ...newRule, sourcePortRange: e.target.value })}
                    />
                    <TextField
                      label="Dest addr"
                      size="small"
                      value={newRule.destinationAddressPrefix}
                      onChange={e =>
                        setNewRule({ ...newRule, destinationAddressPrefix: e.target.value })
                      }
                    />
                    <TextField
                      label="Dest port"
                      size="small"
                      style={{ width: 90 }}
                      value={newRule.destinationPortRange}
                      onChange={e =>
                        setNewRule({ ...newRule, destinationPortRange: e.target.value })
                      }
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={creatingRule || !newRule.name}
                      onClick={handleCreateRule}
                    >
                      {creatingRule ? 'Adding…' : 'Add Rule'}
                    </Button>
                  </div>
                  {ruleError && (
                    <Typography color="error" variant="body2" style={{ marginTop: '0.5rem' }}>
                      {ruleError}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Content>
    </Page>
  );
};
