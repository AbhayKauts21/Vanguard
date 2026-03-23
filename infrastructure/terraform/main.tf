# Data source for existing resource group
data "azurerm_resource_group" "vanguard" {
  name = var.resource_group_name
}

# Data source for current client configuration
data "azurerm_client_config" "current" {}

# Data source for current Azure AD client
data "azuread_client_config" "current" {}

# ========================================
# Service Principal
# ========================================

# Create Azure AD Application
resource "azuread_application" "vanguard_sp" {
  display_name = "${var.project_name}-terraform-sp"
  owners       = [data.azuread_client_config.current.object_id]
}

# Create Service Principal for the application
resource "azuread_service_principal" "vanguard_sp" {
  client_id = azuread_application.vanguard_sp.client_id
  owners    = [data.azuread_client_config.current.object_id]
}

# Create Service Principal Password
resource "azuread_service_principal_password" "vanguard_sp" {
  service_principal_id = azuread_service_principal.vanguard_sp.id
  end_date_relative    = "8760h" # 1 year
}

# Assign Contributor role to Service Principal scoped to vanguard resource group
resource "azurerm_role_assignment" "vanguard_sp_contributor" {
  scope                = data.azurerm_resource_group.vanguard.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.vanguard_sp.object_id
}

# ========================================
# Networking
# ========================================

# Virtual Network
resource "azurerm_virtual_network" "vanguard_vnet" {
  name                = "${var.project_name}-vnet"
  address_space       = var.vnet_address_space
  location            = data.azurerm_resource_group.vanguard.location
  resource_group_name = data.azurerm_resource_group.vanguard.name
  tags                = var.tags
}

# Subnet
resource "azurerm_subnet" "vanguard_subnet" {
  name                 = "${var.project_name}-subnet"
  resource_group_name  = data.azurerm_resource_group.vanguard.name
  virtual_network_name = azurerm_virtual_network.vanguard_vnet.name
  address_prefixes     = [var.subnet_address_prefix]
}

# Network Security Group
resource "azurerm_network_security_group" "vanguard_nsg" {
  name                = "${var.project_name}-nsg"
  location            = data.azurerm_resource_group.vanguard.location
  resource_group_name = data.azurerm_resource_group.vanguard.name
  tags                = var.tags

  security_rule {
    name                         = "SSH"
    priority                     = 1001
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "22"
    source_address_prefixes      = var.allowed_ssh_cidrs
    destination_address_prefix   = "*"
  }

  security_rule {
    name                         = "HTTP"
    priority                     = 1002
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "80"
    source_address_prefixes      = var.allowed_http_cidrs
    destination_address_prefix   = "*"
  }

  security_rule {
    name                         = "HTTPS"
    priority                     = 1003
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "443"
    source_address_prefixes      = var.allowed_https_cidrs
    destination_address_prefix   = "*"
  }

  security_rule {
    name                         = "Grafana"
    priority                     = 1004
    direction                    = "Inbound"
    access                       = "Allow"
    protocol                     = "Tcp"
    source_port_range            = "*"
    destination_port_range       = "3000"
    source_address_prefixes      = var.allowed_grafana_cidrs
    destination_address_prefix   = "*"
  }
}

# Public IP
resource "azurerm_public_ip" "vanguard_public_ip" {
  name                = "${var.project_name}-public-ip"
  location            = data.azurerm_resource_group.vanguard.location
  resource_group_name = data.azurerm_resource_group.vanguard.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

# Network Interface
resource "azurerm_network_interface" "vanguard_nic" {
  name                = "${var.project_name}-nic"
  location            = data.azurerm_resource_group.vanguard.location
  resource_group_name = data.azurerm_resource_group.vanguard.name
  tags                = var.tags

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.vanguard_subnet.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.vanguard_public_ip.id
  }
}

# Associate NSG with Network Interface
resource "azurerm_network_interface_security_group_association" "vanguard_nic_nsg" {
  network_interface_id      = azurerm_network_interface.vanguard_nic.id
  network_security_group_id = azurerm_network_security_group.vanguard_nsg.id
}

# ========================================
# Virtual Machine
# ========================================

# Linux Virtual Machine
resource "azurerm_linux_virtual_machine" "vanguard_vm" {
  name                = "${var.project_name}-vm"
  location            = data.azurerm_resource_group.vanguard.location
  resource_group_name = data.azurerm_resource_group.vanguard.name
  size                = var.vm_size
  admin_username      = var.admin_username
  tags                = var.tags

  # Ensure network interface is created before VM
  depends_on = [
    azurerm_network_interface_security_group_association.vanguard_nic_nsg
  ]

  network_interface_ids = [
    azurerm_network_interface.vanguard_nic.id,
  ]

  admin_ssh_key {
    username   = var.admin_username
    public_key = file(pathexpand(var.ssh_public_key_path))
  }

  os_disk {
    name                 = "${var.project_name}-os-disk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = 128
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  # Custom data script to install Docker, PostgreSQL, and Grafana
  custom_data = base64encode(templatefile("${path.module}/init.sh", {
    ADMIN_USERNAME            = var.admin_username
    POSTGRESQL_REMOTE_ACCESS  = var.postgresql_remote_access
    POSTGRESQL_ALLOWED_CIDR   = var.postgresql_allowed_cidr
  }))

  # Disable password authentication
  disable_password_authentication = true
}
