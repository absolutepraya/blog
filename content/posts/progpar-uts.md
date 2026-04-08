---
title: "ProgPar UTS - Study Guide"
date: 2026-04-05
description: "Rangkuman materi Pemrograman Paralel (ProgPar) untuk persiapan UTS pilihan ganda. Mencakup HPC, Cluster Computing, MPI, OpenMP, dan GPU/CUDA."
tags: ["progpar", "study-guide"]
toc: true
_build:
  list: never
  publishResources: true
  render: always
---

Rangkuman materi ProgPar untuk UTS pilihan ganda. Disusun berdasarkan slide kuliah - fokus ke konsep yang sering muncul di soal pilihan ganda dan jebakan umum.

---

## Topik 1: Pengantar HPC (Kenapa HPC Perlu)

Sebelum masuk ke teknis, kita perlu paham dulu kenapa High Performance Computing itu penting dan di mana dia dipakai.

- **Computational model** = model matematika yang digunakan untuk mempelajari sistem kompleks secara numerik lewat simulasi. Ini fondasi dari semua HPC.
- HPC dibutuhkan karena simulasi yang realistis butuh komputasi yang sangat besar - makin panjang simulasinya, makin besar kebutuhannya

> **HPC (High Performance Computing)** = penggunaan superkomputer dan teknik komputasi paralel untuk menyelesaikan masalah yang terlalu besar/kompleks untuk komputer biasa.

### Contoh Aplikasi HPC

Kenapa HPC diperlukan? Karena banyak masalah dunia nyata yang tidak bisa diselesaikan dengan komputer biasa:

- **Molecular dynamics** - simulasi pergerakan atom/molekul
- **Drug design (in silico)** - desain obat secara virtual, tanpa harus eksperimen lab dulu
- **Oil & gas discovery** - eksplorasi minyak dan gas bumi
- **COVID-19 research** - riset pandemi yang butuh simulasi cepat
- **Hyperthermia simulation** - simulasi terapi kanker menggunakan panas

> **In silico** = eksperimen yang dilakukan di komputer (simulasi), bukan di lab (in vitro) atau di makhluk hidup (in vivo). Sering muncul di konteks drug design.

### GPU vs Cluster

- GPU (contoh: GTX 470) bisa memberikan speedup **11-12x** dibanding cluster 16-core, dengan biaya hanya **25%** dari cluster
- Ini menunjukkan bahwa GPU sangat cost-effective untuk masalah tertentu

### TOP500 dan Indonesia

- **TOP500.org** = situs yang meranking superkomputer dunia
- Ada korelasi antara **kematangan suatu negara** dengan **kapabilitas HPC-nya** - *ini poin yang sering ditanyakan*
- Tantangan Indonesia: big data, biodiversitas besar (30.000+ spesies tanaman, 9.600+ tanaman obat), tapi HPC terbatas

### Solusi HPC

- **Cluster computing** - gabungkan banyak komputer jadi satu unit
- **GPU integration** - manfaatkan GPU untuk komputasi paralel
- **Cloud computing** - gunakan resource cloud on-demand
- **Resource sharing** - berbagi sumber daya antar institusi

### HPC + AI

- Machine learning untuk drug design (virtual screening)
- SGD (Stochastic Gradient Descent) bisa diparalelkan dengan **mini-batch parallelism**

---

## Topik 2: Cluster Computing

Setelah tahu kenapa HPC penting, sekarang kita bahas salah satu implementasinya: cluster computing.

- **Cluster** = beberapa komputer/server yang digabung jadi satu unit untuk performa komputasi yang lebih baik
- Kuncinya: banyak mesin biasa digabungkan, bukan satu mesin super mahal

### Komponen Cluster

Setiap cluster punya komponen-komponen ini - pahami fungsi masing-masing:

| Komponen | Fungsi |
|----------|--------|
| **Nodes** | Unit dasar, bisa fisik atau virtual, punya CPU/RAM/storage/OS |
| **Network** | Jaringan cepat dan reliable untuk komunikasi antar node |
| **Cluster Manager** | Software yang mengkoordinasi operasi dan resource (scheduling, monitoring, alokasi) |
| **Middleware** | Layer software antara OS dan aplikasi |
| **OS** | Sistem operasi di tiap node |
| **Storage** | Penyimpanan data |
| **Security** | Keamanan cluster |

> **Middleware** = software penghubung antara OS dan aplikasi. Dia yang bikin aplikasi gak perlu tahu detail hardware/OS di bawahnya. Contoh: MPI library itu termasuk middleware.

### Jenis-jenis Cluster

*Ini penting buat pilihan ganda - pahami perbedaan tiap jenis:*

| Jenis | Karakteristik |
|-------|---------------|
| **Distributed Computing** | Node tersebar secara geografis |
| **HPC Cluster** | High-performance, tightly coupled (node terhubung erat) |
| **Load Balancing** | Membagi beban kerja ke banyak server secara merata |
| **Cloud Cluster** | Virtual, resource on-demand |
| **GPU Cluster** | Menggunakan GPU untuk parallel processing |
| **Virtual Cluster** | Berjalan di atas virtual machines |

### Kelebihan dan Kekurangan Cluster

| Kelebihan | Kekurangan |
|-----------|------------|
| High performance | Konfigurasi kompleks |
| Scalability | Pengembangan aplikasi sulit |
| Efisiensi energi | Ketergantungan pada jaringan |
| Reliability | Biaya awal tinggi |
| Cost effective | Manajemen intensif |
| Flexibility | |

### Mode Operasi Cluster

*Ini penting - sering keluar di soal:*

| Mode | Deskripsi |
|---|---|
| **High Performance** | Dedicated, untuk komputasi berat (simulasi, HPC) |
| **High Throughput** | Memanfaatkan idle cycles dari banyak workstation. Pool of resources yang shared |
| **High Availability** | Fail-over, untuk mission-critical apps (bank, kontrol nuklir). Kalau satu node mati, yang lain ambil alih |
| **Unified** | Gabungan HP + HA dalam satu cluster. Tren ke depan |

> **High Throughput** = bukan tentang kecepatan satu job, tapi tentang menjalankan BANYAK job secara kolektif. Contoh: SETI@home.

> **High Availability** = menjamin uptime, bukan kecepatan. Kalau node gagal, service tetap jalan.

### Klasifikasi Cluster (6 cara)

| Klasifikasi | Contoh |
|---|---|
| Berdasarkan **aplikasi** | HP Cluster vs HA Cluster |
| Berdasarkan **kepemilikan node** | Dedicated vs Non-dedicated |
| Berdasarkan **hardware** | CoPs (PCs), COWs (Workstations), CLUMPs (SMPs) |
| Berdasarkan **OS** | Linux (Beowulf), Solaris (Berkeley NOW), NT (HPVM) |
| Berdasarkan **konfigurasi** | Homogeneous vs Heterogeneous |
| Berdasarkan **skala** | Group (2-99), Departmental (10s-100s), National, International (Grid) |

> **Beowulf** = cluster dari PC commodity yang menjalankan Linux, terhubung via Ethernet, menggunakan MPI/PVM. Nama paling terkenal untuk Linux cluster.

> **CLUMPs** (Clusters of SMPs) = gabungan keunggulan SMP (mudah diprogram) dengan skalabilitas cluster.

### Arsitektur Berlapis Cluster

Dari bawah ke atas:
- Network Interface Hardware + Cluster Interconnection
- Communications Software
- PC/Workstation nodes
- **Cluster Middleware** (SSI + Availability Infrastructure)
- Parallel Programming Environment (MPI, PVM)
- Sequential/Parallel Applications

> **SSI (Single System Image)** = cluster yang terlihat seperti satu komputer dari sisi pengguna. Ini yang membedakan cluster dari distributed system biasa.

### Teknologi Jaringan Cluster

*Tabel ini sering muncul di soal pilihan ganda:*

| Teknologi | Bandwidth | Latency |
|---|---|---|
| Ethernet | 10 Mbps | Tinggi |
| Fast Ethernet | 100 Mbps | Sedang |
| Gigabit Ethernet | 1 Gbps | Sedang |
| **Myrinet** | 1.28 Gbps | 5 us |
| **InfiniBand** | Tinggi | Rendah |
| **SCI** | - | 12 us |
| **QsNet** (Quadrics) | - | 5 us |

***Trap question:*** InfiniBand dan Myrinet sering muncul sebagai pilihan "jaringan tercepat untuk cluster". Myrinet punya on-board processor yang bisa diprogram.

---

## Topik 3: Membangun Cluster

Sekarang kita masuk ke bagaimana cluster dibangun - mulai dari arsitektur sampai tools yang dipakai.

### Arsitektur Komputer Paralel yang Scalable

*Tabel ini sering muncul di soal pilihan ganda - perhatikan perbedaan memory model dan jumlah OS:*

| Arsitektur | Memory | Jumlah OS | Nodes | Interconnect |
|------------|--------|-----------|-------|-------------|
| **MPP** (Massively Parallel Processors) | Shared-nothing (terpisah) | Tiap node punya OS sendiri | Ratusan node | High-speed interconnect |
| **SMP** (Symmetric Multiprocessors) | Shared-everything (berbagi) | Satu copy OS | 2-64 prosesor | Internal bus |
| **Distributed Systems** | Terpisah | Tiap node punya OS sendiri | Bervariasi | Jaringan konvensional |
| **Clusters** | Terpisah per node | Single system image | 2+ workstation/PC | High-speed network |

> **Shared-nothing** = tiap node punya memori sendiri, tidak berbagi dengan node lain. Komunikasi lewat message passing.
>
> **Shared-everything** = semua prosesor mengakses memori yang sama. Komunikasi lewat shared variables.
>
> **Single system image** = meskipun terdiri dari banyak komputer, cluster terlihat seperti satu komputer dari sisi pengguna.

**Definisi cluster yang sering dikutip:**
"A cluster is a type of parallel or distributed processing system, which consists of a collection of interconnected stand-alone computers cooperatively working together as a single, integrated computing resource."

***Trap question:*** Soal mungkin mencampuradukkan MPP dan SMP. Ingat: **MPP = shared-nothing, banyak OS**. **SMP = shared-everything, satu OS**. Jangan kebalik!

### Karakteristik Cluster

- Satu node bisa single/multiprocessor system dengan memori, I/O, dan OS sendiri
- Umumnya 2+ komputer yang terhubung
- Bisa dalam satu cabinet atau terpisah secara fisik lewat LAN

### Level Paralelisme (Code Granularity)

*Ini taxonomy penting yang sering muncul di soal:*

| Level | Granularity | Unit Kode | Tool |
|---|---|---|---|
| **Large grain** | Task level | Program | PVM, MPI |
| **Medium grain** | Control level | Function/thread | Threads, OpenMP |
| **Fine grain** | Data level | Loop | Compiler directives |
| **Very fine grain** | Multiple issue | Instruksi | Hardware (CPU) |

***Trap question:*** MPI = large grain (task level). OpenMP = medium grain (thread level). Compiler = fine grain (loop level). Jangan kebalik!

### Amdahl's Law

> **Amdahl's Law** = speed-up yang didapat dari prosesor lebih cepat dibatasi oleh komponen sistem yang paling lambat. Contoh: kalau 20% kode tidak bisa diparalelkan, speed-up maksimum hanya 5x, berapa pun jumlah prosesornya.

### Fakta Top500

- Tahun 2017: **87%** (437 dari 500) superkomputer terkuat dunia adalah cluster
- Ini menunjukkan cluster sudah jadi arsitektur dominan, mengalahkan MPP dan SMP

### Langkah Membangun Cluster

Planning - Hardware selection - Network setup - OS installation - Middleware - Cluster manager install - Security config - Testing - Monitoring - Documentation - Maintenance

### SLURM (Cluster Manager)

SLURM adalah cluster manager yang paling umum digunakan. Pahami 3 fungsi utamanya:

> **SLURM** = Simple Linux Utility for Resource Management. Open source, fault-tolerant, highly scalable.

**Tiga fungsi utama SLURM:**

1. **Alokasi resource** - memberikan akses eksklusif/non-eksklusif ke compute nodes untuk durasi tertentu
2. **Framework job** - memulai, menjalankan, dan memonitor jobs (termasuk parallel jobs)
3. **Antrian job** - mengelola resource contention lewat pending job queues

### Arsitektur SLURM

| Komponen | Fungsi |
|----------|--------|
| **slurmctld** | Central manager daemon (otak SLURM) |
| **slurmd** | Daemon di setiap node (eksekutor) |
| **slurmdbd** | Database daemon (menyimpan data akuntansi) |
| **slurmrestd** | REST API daemon |

### Tools SLURM

| Tool | Fungsi | Tipe |
|------|--------|------|
| **srun** | Menjalankan job | User |
| **scancel** | Membatalkan job | User |
| **sinfo** | Info tentang nodes dan partitions | User |
| **squeue** | Info tentang job di antrian | User |
| **sacct** | Info akuntansi job | User |
| **scontrol** | Kontrol konfigurasi | Admin |
| **sacctmgr** | Manajemen akuntansi | Admin |

***Trap question:*** Soal bisa menanyakan mana yang user tool vs admin tool. **scontrol dan sacctmgr = admin. Sisanya = user.**

### Entitas dalam SLURM

- **Nodes** - komputer fisik/virtual
- **Partitions** - pengelompokan nodes (= job queues)
- **Jobs** - pekerjaan yang di-submit user
- **Job Steps** - langkah-langkah dalam satu job

---

## Topik 4: Pemrograman MPI

Ini topik paling berat dan paling banyak keluar di UTS. MPI adalah cara program berkomunikasi di sistem distributed memory.

> **MPI (Message Passing Interface)** = standar/spesifikasi untuk pemrograman paralel berbasis message passing. Bukan library spesifik, tapi standar yang diimplementasikan oleh berbagai library (OpenMPI, MPICH, dll).

### Konsep Dasar MPI

- **Process-centric model** - setiap proses punya memori sendiri, independen
- **Explicit message passing** - programmer harus secara eksplisit mengirim dan menerima pesan
- **Communicator** - mendefinisikan grup proses. `MPI_COMM_WORLD` = semua proses

### Struktur Program MPI

Setiap program MPI harus mengikuti pola ini:

```c
MPI_Init(&argc, &argv);          // Inisialisasi MPI
MPI_Comm_rank(MPI_COMM_WORLD, &rank);  // Dapat rank (ID proses)
MPI_Comm_size(MPI_COMM_WORLD, &size);  // Dapat jumlah proses

// ... komputasi dan komunikasi ...

MPI_Finalize();                  // Akhiri MPI
```

***Trap question:*** `MPI_Comm_rank` memberikan **rank** (ID unik proses, mulai dari 0). `MPI_Comm_size` memberikan **jumlah total proses**. Jangan tertukar!

### Jenis Komunikasi MPI

Ada dua kategori besar: point-to-point dan collective.

**Point-to-Point (antara 2 proses):**

| Fungsi | Arah | Penjelasan |
|--------|------|------------|
| `MPI_Send` | Pengirim ke penerima | Mengirim data ke proses tertentu |
| `MPI_Recv` | Penerima dari pengirim | Menerima data dari proses tertentu |

**Collective (melibatkan semua proses):**

| Fungsi | Pola | Penjelasan |
|--------|------|------------|
| `MPI_Bcast` | One-to-all | Broadcast data dari satu proses ke semua |
| `MPI_Scatter` | One-to-all (bagi rata) | Bagi data dari satu proses ke semua (setiap proses dapat bagian berbeda) |
| `MPI_Gather` | All-to-one | Kumpulkan data dari semua proses ke satu proses |
| `MPI_Reduce` | All-to-one (dengan operasi) | Gabungkan data dari semua proses dengan operasi (SUM, MAX, MIN, dll) |
| `MPI_Allreduce` | All-to-all (reduce + broadcast) | Reduce lalu hasilnya di-broadcast ke semua |
| `MPI_Allgather` | All-to-all (gather + broadcast) | Gather lalu hasilnya di-broadcast ke semua |
| `MPI_Barrier` | Synchronization | Semua proses menunggu sampai semua sampai di titik ini |

***Trap question - Bcast vs Scatter:*** Keduanya one-to-all, tapi **Bcast mengirim data yang SAMA ke semua proses**, sedangkan **Scatter membagi data menjadi bagian-bagian BERBEDA untuk tiap proses**. Ini sering dikacaukan di soal!

***Trap question - Reduce vs Allreduce:*** **Reduce** menyimpan hasil di SATU proses (root). **Allreduce** menyimpan hasil di SEMUA proses. Kalau soal tanya "semua proses mendapat hasil", jawabannya Allreduce.

### Operasi Reduce

`MPI_Reduce` mendukung operasi: `MPI_SUM`, `MPI_MAX`, `MPI_MIN`, `MPI_PROD`, dll.

### Timing

- `MPI_Wtime()` - mengukur wall clock time (waktu nyata yang berlalu)

### Kompilasi dan Eksekusi

```bash
mpicc program.c -o program          # Kompilasi
mpirun -np 4 ./program              # Jalankan dengan 4 proses
```

- `-np` menentukan jumlah proses. Kalau `-np 4`, maka rank = 0, 1, 2, 3

### Blocking vs Non-Blocking

| Tipe | Fungsi | Perilaku |
|---|---|---|
| **Blocking** | MPI_Send, MPI_Recv | Menunggu sampai operasi selesai. MPI_Recv selalu block sampai pesan diterima |
| **Non-blocking** | MPI_Isend, MPI_Irecv | Menginisiasi komunikasi lalu lanjut kerja. Cek status dengan MPI_Wait atau MPI_Test |

***Trap question:*** MPI_Send itu blocking, tapi perilakunya **implementation-dependent** - bisa buffer dulu (return cepat) atau block sampai receiver siap. Program yang mengandalkan buffering disebut **unsafe**.

### Deadlock di MPI

- Terjadi kalau semua proses panggil MPI_Send (blocking) sebelum MPI_Recv - tidak ada yang bisa terima pesan
- Solusi: **MPI_Sendrecv** - gabungan send dan receive dalam satu panggilan, mencegah deadlock
- Solusi lain: gunakan non-blocking (MPI_Isend/MPI_Irecv)

### Message Tags dan Wildcards

- Setiap pesan MPI punya **tag** (integer) untuk membedakan pesan
- **MPI_ANY_SOURCE** - terima dari proses manapun
- **MPI_ANY_TAG** - terima pesan dengan tag apapun
- **MPI_Status** - struct yang berisi MPI_SOURCE, MPI_TAG, MPI_ERROR setelah receive

### MPI_Scan (Prefix Reduction)

> **MPI_Scan** = prefix reduction. Setiap proses i mendapat hasil reduce dari proses 0 sampai i. Contoh SUM: proses 0 dapat a0, proses 1 dapat a0+a1, proses 2 dapat a0+a1+a2, dst.

***Trap question:*** MPI_Scan BUKAN running sum dalam satu proses. Ini operasi antar-proses. Jangan bingung dengan MPI_Reduce.

### Distribusi Data

| Tipe | Pola | Contoh (8 elemen, 4 proses) |
|---|---|---|
| **Block** | Elemen berurutan | P0:[0,1], P1:[2,3], P2:[4,5], P3:[6,7] |
| **Cyclic** | Round-robin | P0:[0,4], P1:[1,5], P2:[2,6], P3:[3,7] |
| **Block-cyclic** | Round-robin per blok | P0:[0,1,4,5], P1:[2,3,6,7] (block=2) |

MPI_Scatter menggunakan distribusi **block** secara default.

### Aturan Collective Communication

- Semua proses HARUS panggil fungsi collective yang sama (ga bisa match Reduce dengan Recv)
- Collective communication TIDAK pakai tags - di-match berdasarkan communicator dan urutan panggilan
- **MPI_Reduce(&x, &x, ...)** pakai buffer yang sama untuk send dan receive itu **ILLEGAL**

### Reduction Operators Lengkap

Selain MPI_SUM, MPI_MAX, MPI_MIN, MPI_PROD, ada juga:
- **MPI_MAXLOC, MPI_MINLOC** - return nilai + rank proses yang punya nilai tersebut
- MPI_BAND, MPI_BOR, MPI_BXOR - bitwise AND, OR, XOR
- MPI_LAND, MPI_LOR, MPI_LXOR - logical AND, OR, XOR

### Hybrid MPI + OpenMP

- MPI untuk komunikasi **antar node**, OpenMP untuk paralelisme **dalam node**
- Keuntungan: menghindari overhead MPI intra-node, fine granularity + dynamic load balancing
- Compile: `mpicc -fopenmp`, run: `mpiexec -n 4 ./program` (4 proses MPI, masing-masing bisa spawn OpenMP threads)
- Performa: di 128 CPU, hybrid (4 thread) bisa **4.44x lebih cepat** dari pure MPI

---

## Topik 5: Pemrograman OpenMP

Kalau MPI untuk distributed memory (antar node), OpenMP untuk shared memory (dalam satu node dengan banyak core).

> **OpenMP** = API untuk pemrograman paralel di shared memory system. Menggunakan compiler directives (pragma) untuk memparalelkan kode secara inkremental.

### Fork-Join Model

- Program dimulai dengan **satu master thread**
- Saat ketemu parallel region, master thread **fork** menjadi tim thread
- Setelah parallel region selesai, thread-thread **join** kembali ke master thread
- Ini terjadi berulang-ulang selama eksekusi program

> **Fork-join** = model eksekusi di mana satu thread (master) membuat banyak thread (fork) untuk kerja paralel, lalu menunggu semua selesai dan bergabung kembali (join).

### Directives OpenMP

Semua directive diawali `#pragma omp`:

| Directive | Fungsi |
|-----------|--------|
| `#pragma omp parallel` | Membuat parallel region (fork thread) |
| `#pragma omp for` | Memparalelkan for loop (bagi iterasi ke thread) |
| `#pragma omp parallel for` | Gabungan parallel + for (shortcut) |
| `#pragma omp sections` | Membagi kerja menjadi sections terpisah |
| `#pragma omp critical` | Mutual exclusion - hanya satu thread yang boleh masuk |
| `#pragma omp atomic` | Operasi atomik (lebih ringan dari critical) |
| `#pragma omp barrier` | Sinkronisasi - semua thread menunggu di titik ini |

***Trap question:*** **critical vs atomic** - keduanya untuk sinkronisasi, tapi **atomic** lebih ringan dan hanya untuk operasi sederhana (increment, assignment). **critical** lebih general tapi lebih berat (overhead lebih besar).

### Clauses OpenMP

Clauses ditambahkan setelah directive untuk mengontrol perilaku:

| Clause | Fungsi |
|--------|--------|
| `private(var)` | Setiap thread punya copy var sendiri (tidak di-share) |
| `shared(var)` | Semua thread mengakses var yang sama |
| `reduction(op:var)` | Tiap thread punya copy lokal, di akhir digabung dengan operasi op |
| `schedule(type, chunk)` | Cara membagi iterasi loop ke thread |
| `num_threads(n)` | Menentukan jumlah thread |

***Trap question:*** Variabel yang dideklarasikan di dalam parallel region otomatis **private**. Variabel yang dideklarasikan di luar otomatis **shared**. Tapi ini bisa di-override dengan clause.

### Directives Tambahan

| Directive | Fungsi |
|---|---|
| `nowait` | Thread yang selesai bisa lanjut tanpa menunggu thread lain. Tanpa ini, ada implicit barrier di akhir work-sharing |
| `ordered` | Block dieksekusi sesuai urutan iterasi sequential loop |
| `default(shared)` | Semua variabel shared kecuali yang di-mark private |

### Runtime Functions

| Fungsi | Return |
|---|---|
| `omp_get_num_threads()` | Jumlah thread aktif saat ini |
| `omp_get_thread_num()` | ID thread (0 sampai num_threads-1) |
| `omp_get_num_procs()` | Jumlah prosesor yang tersedia |
| `omp_set_num_threads(n)` | Set jumlah thread untuk parallel region berikutnya |

### Default Sharing Rules

- Semua variabel di work-sharing region default-nya **shared**
- KECUALI **loop iteration counter** - otomatis **private**
- Kalau ragu, pakai `default(none)` dan deklarasikan semua variabel secara eksplisit

***Trap question:*** Loop counter (misal `i` di `for(int i=...)`) otomatis private di OpenMP parallel for. Tapi variabel lain yang dideklarasi di luar loop otomatis shared!

---

## Topik 6: MPI vs OpenMP

Ini perbandingan paling penting - hampir pasti muncul di UTS.

| Aspek | MPI | OpenMP |
|-------|-----|--------|
| **Memory model** | Distributed (tiap proses punya memori sendiri) | Shared (semua thread berbagi memori) |
| **Komunikasi** | Explicit message passing (kirim/terima pesan) | Implicit lewat shared variables |
| **Unit paralelisme** | Process (coarse-grained) | Thread (fine-grained) |
| **Scalability** | Cluster, distributed systems (banyak node) | Single node, multi-core |
| **Kompleksitas** | Lebih kompleks, harus tulis send/recv | Lebih simpel, tinggal tambah pragma |
| **Use case** | Multi-node clusters | Multi-core single machine |
| **Overhead** | Network communication | Thread creation/synchronization |
| **Hybrid** | Bisa digabung dengan OpenMP (antar node) | Bisa digabung dengan MPI (dalam node) |

***Trap question:*** Soal mungkin tanya "mana yang lebih baik?" - jawabannya **tergantung konteks**. MPI untuk multi-node, OpenMP untuk single node. Bisa juga digabung (hybrid MPI+OpenMP) untuk cluster dengan node multi-core.

> **Coarse-grained parallelism** = paralelisme di level besar (proses), komunikasi jarang tapi banyak data.
>
> **Fine-grained parallelism** = paralelisme di level kecil (thread), komunikasi sering tapi sedikit data.

---

## Topik 7: GPU Computing dan CUDA

GPU awalnya untuk grafis, tapi sekarang banyak dipakai untuk komputasi paralel karena punya ribuan core.

> **CUDA (Compute Unified Device Architecture)** = platform dan model pemrograman dari NVIDIA untuk komputasi di GPU.

### CPU vs GPU

- **CPU** = few cores (4-64), optimized for sequential tasks, complex control logic
- **GPU** = thousands of cores (ratusan-ribuan), optimized for data-parallel tasks, simple control logic
- GPU unggul di tugas **data-parallel** - operasi yang sama diterapkan ke banyak elemen data

> **Data-parallel** = pola komputasi di mana operasi yang sama dilakukan secara bersamaan pada banyak elemen data berbeda. Contoh: menambah 1 ke setiap elemen array.

### Model Pemrograman CUDA

CUDA membagi komputasi antara dua "device":

| Istilah | Hardware | Peran |
|---------|----------|-------|
| **Host** | CPU + RAM | Menjalankan kode sekuensial, mengatur GPU |
| **Device** | GPU + VRAM | Menjalankan kernel (kode paralel) |

Alur kerja CUDA:
1. Alokasi memori di GPU (`cudaMalloc`)
2. Copy data dari CPU ke GPU (`cudaMemcpy`, HostToDevice)
3. Jalankan kernel di GPU (`kernel<<<blocks, threads>>>`)
4. Copy hasil dari GPU ke CPU (`cudaMemcpy`, DeviceToHost)
5. Free memori GPU (`cudaFree`)

### Kernel dan Thread Hierarchy

- **Kernel** = fungsi yang dijalankan di GPU oleh banyak thread sekaligus. Ditandai dengan `__global__`
- Thread diorganisasi dalam hierarki:

```
Grid
  |-- Block 0
  |     |-- Thread 0, Thread 1, Thread 2, ...
  |-- Block 1
  |     |-- Thread 0, Thread 1, Thread 2, ...
  |-- Block 2
  ...
```

- **Grid** = kumpulan semua blocks
- **Block** = kumpulan threads yang bisa saling berbagi shared memory
- **Thread** = unit eksekusi terkecil

### Indexing Thread

Setiap thread punya ID unik yang dihitung dari:
```
idx = threadIdx.x + blockIdx.x * blockDim.x
```

| Variable | Artinya |
|----------|---------|
| `threadIdx.x` | Index thread dalam block-nya |
| `blockIdx.x` | Index block dalam grid |
| `blockDim.x` | Jumlah thread per block |

***Trap question:*** Soal sering kasih konfigurasi `<<<numBlocks, blockSize>>>` dan tanya berapa total thread. Jawabannya: **numBlocks x blockSize**. Contoh: `<<<4, 256>>>` = 4 x 256 = 1024 threads.

### Tipe Memori CUDA

*Tabel ini kritis - sering muncul di soal:*

| Memori | Scope | Kecepatan | Ukuran | Catatan |
|--------|-------|-----------|--------|---------|
| **Register** | Per thread | Paling cepat | Sangat kecil | Variabel lokal thread |
| **Shared** | Per block | Cepat | ~48KB | Thread dalam satu block bisa berbagi |
| **Global** | Seluruh grid | Lambat | GB | Memori utama GPU, semua thread bisa akses |
| **Constant** | Seluruh grid | Cepat (cached) | 64KB | Read-only, bagus untuk konstanta |
| **Texture** | Seluruh grid | Cepat (cached) | Tergantung | Optimized untuk pola akses spasial |

***Trap question:*** **Shared memory** itu per BLOCK, bukan per grid. Thread dari block berbeda TIDAK bisa saling akses shared memory. Ini sering dijadikan jebakan.

### Contoh Pola CUDA

```c
__global__ void kernel(float *d_out, float *d_in) {
    int idx = threadIdx.x + blockIdx.x * blockDim.x;
    d_out[idx] = d_in[idx] * d_in[idx];
}

int main() {
    // Alokasi memori GPU
    cudaMalloc(&d_in, size);
    cudaMalloc(&d_out, size);

    // Copy data CPU -> GPU
    cudaMemcpy(d_in, h_in, size, cudaMemcpyHostToDevice);

    // Jalankan kernel
    kernel<<<numBlocks, blockSize>>>(d_out, d_in);

    // Copy hasil GPU -> CPU
    cudaMemcpy(h_out, d_out, size, cudaMemcpyDeviceToHost);
}
```

### Sifat Penting GPU/CUDA

- Blocks bisa berjalan di urutan apapun - ini yang bikin GPU scalable (tambah SM, tambah performance)
- Thread dalam satu block bisa disinkronisasi dengan `__syncthreads()`
- Thread dari block berbeda TIDAK bisa disinkronisasi langsung

---

## PR1: Pemrograman MPI di Cluster dan Multicore

PR1 adalah tugas praktik utama di ProgPar - kita mengimplementasikan program paralel dengan MPI, menjalankannya di dua lingkungan berbeda, dan menganalisis hasilnya. Bagian ini penting karena soal esai kemungkinan besar berkaitan dengan apa yang kita kerjakan di PR1.

### Dua Lingkungan Eksperimen

Semua eksperimen dijalankan di dua environment untuk membandingkan performa:

| | Lingkungan A - Cluster | Lingkungan B - Multicore |
|---|---|---|
| **Tipe** | Multi-node (banyak mesin) | Single node (satu mesin banyak core) |
| **Jumlah core** | 6 nodes x 8 cores = 48 cores | 64 cores |
| **Cara menjalankan** | `sbatch` (submit ke SLURM queue) | `mpirun -np N` (langsung) |
| **Komunikasi antar proses** | Lewat jaringan (network) - lambat | Lewat shared memory - cepat |
| **Perintah run** | `srun --mpi=pmix -n N` | `mpirun -np N` |

> **Kenapa dua lingkungan?** Supaya kita bisa membandingkan **overhead komunikasi**. Di cluster, komunikasi antar node lewat jaringan (lambat). Di multicore, semua proses ada di satu mesin (shared memory, cepat).

### Topik 1 PR1: Hello World MPI

Ini program MPI paling basic - setiap proses mencetak "Hello World" beserta rank-nya.

- Dijalankan dengan NP = 2, 4, 8, 16, 32
- **Temuan utama**: urutan output **TIDAK konsisten** antar-run
- Kenapa? Karena proses MPI berjalan **paralel** dan OS scheduler menentukan urutan eksekusi secara **non-deterministik**
- Di cluster, ranks terbagi per node (misal rank 0-7 di node-01, rank 8-15 di node-03), tapi urutan dalam node tetap acak
- Di multicore, semua ranks ada di satu mesin

**Konsep yang dibuktikan:** paralelisme = non-deterministic execution order.

### Topik 2 PR1: Perkalian Matriks Paralel

Dua sub-tugas: Matrix-Vector (Mat x Vec) dan Matrix-Matrix (Mat x Mat). Format hasil: **(waktu komputasi / waktu komunikasi)** dalam detik.

**Strategi paralel (row-wise distribution):**

1. Root process generate matriks A dan vektor/matriks B (`srand(42)` untuk reproducibility)
2. `MPI_Scatter` - bagi baris-baris A ke semua proses (setiap proses dapat `N/NP` baris)
3. `MPI_Bcast` - broadcast B ke semua proses (semua butuh B lengkap)
4. Setiap proses hitung perkalian lokal (baris A lokal x B)
5. `MPI_Gather` - kumpulkan hasil dari semua proses ke root
6. `MPI_Reduce(MPI_MAX)` - ambil waktu maksimum dari semua proses untuk timing

> **Row-wise distribution** = strategi distribusi data di mana matriks dibagi berdasarkan baris. Proses 0 dapat baris 0 sampai N/NP-1, proses 1 dapat baris N/NP sampai 2N/NP-1, dst.

**Variasi eksperimen:**
- Ukuran matriks: N = 512, 1024, 2048, 4096
- Jumlah proses: NP = 2, 4, 8, 16, 32

**Temuan utama:**

- **Waktu komputasi turun** seiring NP naik - ini yang disebut **speed-up**
- Contoh: Mat x Mat N=4096, NP=2 butuh 1125 detik, NP=32 butuh 110 detik - speed-up sekitar 10x
- **Komunikasi mendominasi** di cluster - karena data harus dikirim lewat jaringan
  - Contoh: N=512 NP=32, cluster butuh 0.246s komunikasi vs multicore cuma 0.007s
- **Trade-off**: untuk matriks kecil (N=512), overhead komunikasi lebih besar dari manfaat paralelisasi. Untuk N besar, speed-up nyata terlihat

***Penting untuk esai:*** Kalau ditanya "apakah menambah prosesor selalu mempercepat?", jawabannya **TIDAK**. Ada titik di mana overhead komunikasi melebihi keuntungan paralelisasi - ini disebut **diminishing returns**.

### Topik 3 PR1: Process Topologies MPI

Program ini mendemonstrasikan 6 fitur MPI untuk mengatur **bagaimana proses berkomunikasi dalam topologi terstruktur** (grid 2D):

| Tahap | Fitur MPI | Fungsi |
|-------|-----------|--------|
| 1 | `MPI_Dims_create` | Otomatis distribusi N proses ke grid 2D (misal 16 proses menjadi 4x4) |
| 2 | `MPI_Cart_create` + `MPI_Cart_coords` | Buat topologi Cartesian periodik, tiap proses punya koordinat (row, col) |
| 3 | `MPI_Cart_shift` + `MPI_Sendrecv` | Komunikasi dengan tetangga (atas/bawah/kiri/kanan) |
| 4 | `MPI_Cart_sub` | Pecah grid jadi sub-communicator per baris |
| 5 | Latency Benchmark | Ukur latensi komunikasi (1000 iterasi Sendrecv bolak-balik) |
| 6 | `MPI_Cartdim_get` + `MPI_Cart_get` | Inspeksi topologi: cek dimensi, periodisitas, koordinat |

> **Cartesian topology** = pengaturan proses MPI dalam grid multidimensi (biasanya 2D). Berguna untuk masalah yang punya struktur grid alami, seperti simulasi fisika 2D.

> **Periodik** = proses di tepi grid terhubung dengan proses di tepi seberangnya (wrap-around, seperti donat/torus).

**Temuan latency benchmark:**

| | NP=2 | NP=4 | NP=8 | NP=16 | NP=32 |
|---|---|---|---|---|---|
| Multicore (min) | 0.19 us | 1.0 us | 0.31 us | 23.6 us | 7.6 us |
| Multicore (max) | 0.60 us | 2.4 us | 9.7 us | 136 us | 204 us |
| Cluster (min) | 0.16 us | 0.32 us | 0.51 us | - | - |
| Cluster (max) | 0.16 us | 0.37 us | 0.58 us | - | - |

- Multicore: latency naik seiring NP karena **contention** (banyak proses berebut akses memori)
- Cluster NP kecil: latency sangat stabil karena masih dalam 1 node (shared memory)

### Topik 4 PR1: Jacobi Iteration (SPL Paralel)

Menyelesaikan sistem persamaan linier (Ax = b) secara paralel menggunakan metode iterasi Jacobi. Referensi: Bab 7 buku Rauber & Runger.

> **Jacobi Iteration** = metode iteratif untuk menyelesaikan sistem persamaan linier. Setiap iterasi, nilai x baru dihitung dari nilai x sebelumnya. Prosesnya diulang sampai konvergen (nilai x tidak berubah lagi).

**Rumus Jacobi:**
```
x_i^(k+1) = (1/a_ii) * (b_i - sum(a_ij * x_j^(k), j != i))
```

**Strategi paralel (mirip pattern Mat x Vec):**

1. Root generate matriks A yang **diagonally dominant** dan vektor b
2. `MPI_Scatter` baris A dan elemen b ke semua proses
3. **Loop iterasi:**
   - **Komputasi**: setiap proses hitung x baru untuk baris lokalnya
   - **Komunikasi**: `MPI_Allgather` untuk berbagi x terbaru ke semua proses
   - **Konvergensi**: `MPI_Allreduce(MPI_MAX)` untuk cek apakah max|x_baru - x_lama| < epsilon
4. Berhenti kalau konvergen atau mencapai max iterasi

> **Diagonally dominant** = matriks di mana nilai absolut diagonal lebih besar dari jumlah nilai absolut elemen lain di baris yang sama. Syarat agar Jacobi iteration pasti konvergen.

**Variasi eksperimen:** N = 512-4096, NP = 1, 2, 4, 8, 16, 32 (NP=1 untuk baseline sequential)

**Temuan:**
- Semua run konvergen dalam 12-15 iterasi
- Speed-up komputasi signifikan: N=4096 dari 0.668s (NP=1) ke 0.034s (NP=32) - speed-up ~19.6x
- Tapi **komunikasi mendominasi** karena setiap iterasi butuh Allgather + Allreduce

***Poin penting untuk esai:***

- Jacobi itu **embarrassingly parallel** pada bagian komputasi (setiap proses independen menghitung x-nya)
- Tapi **communication-bound** karena setiap iterasi perlu sinkronisasi (Allgather x, Allreduce convergence)
- Semakin banyak iterasi = semakin banyak komunikasi = overhead makin besar

### Pola Umum Program MPI di PR1

Hampir semua program PR1 mengikuti pola yang sama:

```
1. MPI_Init
2. Root generate data (srand(42) untuk reproducibility)
3. MPI_Scatter data ke semua proses
4. Setiap proses hitung bagiannya (COMPUTATION - diukur waktunya)
5. MPI_Gather/Allgather hasil (COMMUNICATION - diukur waktunya)
6. MPI_Reduce untuk ambil waktu max
7. Root cetak hasil (waktu komputasi, waktu komunikasi, total)
8. MPI_Finalize
```

**Yang dianalisis:**
- **Computation time** - makin banyak proses, makin cepat (speed-up)
- **Communication time** - makin banyak proses, overhead makin besar
- **Speed-up** = T_sequential / T_parallel
- **Perbandingan cluster vs multicore** - cluster punya overhead komunikasi jauh lebih besar

### Mengukur Waktu di MPI

```c
double t_start = MPI_Wtime();
// ... kode yang diukur ...
double t_end = MPI_Wtime();
double elapsed = t_end - t_start;

// Ambil waktu max dari semua proses (bottleneck = yang paling lambat)
double max_time;
MPI_Reduce(&elapsed, &max_time, 1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
```

Kenapa pakai `MPI_MAX`? Karena total waktu program ditentukan oleh proses **paling lambat** (yang lain harus menunggu).

---

## Tips Menghadapi UTS

Rangkuman jebakan umum dan strategi menjawab soal pilihan ganda:

### Jebakan yang Sering Muncul

- **MPP vs SMP** - MPP = shared-nothing + banyak OS. SMP = shared-everything + satu OS. Jangan kebalik
- **Bcast vs Scatter** - Bcast kirim data SAMA ke semua. Scatter BAGI data berbeda ke tiap proses
- **Reduce vs Allreduce** - Reduce hasilnya di satu proses. Allreduce hasilnya di semua proses
- **MPI_Comm_rank vs MPI_Comm_size** - rank = ID proses (mulai 0). size = total jumlah proses
- **critical vs atomic (OpenMP)** - atomic lebih ringan, untuk operasi sederhana. critical lebih general
- **Shared memory CUDA** - scope-nya per BLOCK, bukan per grid
- **private vs shared (OpenMP)** - variabel di dalam parallel region otomatis private, di luar otomatis shared
- **scontrol vs srun (SLURM)** - scontrol = admin tool, srun = user tool

### Strategi Menjawab

- Kalau soal tanya tentang **memory model**, identifikasi dulu: distributed (MPI) atau shared (OpenMP/CUDA)
- Kalau soal tentang **komunikasi MPI**, gambarkan di kertas: siapa kirim, siapa terima, data apa
- Kalau soal tentang **CUDA thread indexing**, hitung pakai rumus: `threadIdx.x + blockIdx.x * blockDim.x`
- Kalau soal tanya **jumlah total thread CUDA**, kalikan: `numBlocks x blockSize`
- Kalau ragu antara dua jawaban yang mirip, cari **kata kunci pembeda** - sering ada satu kata yang bikin salah satu jawaban jelas salah
- Perhatikan kata "BUKAN" atau "KECUALI" di soal - ini sering bikin salah baca

### Topik yang Paling Sering Keluar

1. **Perbandingan MPI vs OpenMP** - hampir pasti ada
2. **Fungsi-fungsi collective MPI** (Bcast, Scatter, Gather, Reduce) - pahami perbedaannya
3. **Arsitektur paralel** (MPP vs SMP vs Cluster vs Distributed) - hafal tabelnya
4. **CUDA memory hierarchy** - register, shared, global
5. **CUDA thread indexing** - rumus menghitung index
6. **Komponen cluster** dan fungsinya
7. **SLURM** - fungsi utama dan tools-nya

---

## Tutorial: Akses Cluster dan Multicore Fasilkom UI

Ini panduan praktis untuk akses kedua komputer yang dipakai di PR1. Berguna untuk bagian **praktik UTS** (30% bobot) yang mengharuskan login dan menjalankan program MPI.

### Dua Lingkungan

| | Cluster (Lingkungan A) | Multicore (Lingkungan B) |
|---|---|---|
| Alamat | `152.118.31.24` | `152.118.31.61` |
| Username | `user04` (sesuai kelompok) | `user04` (sama) |
| Tipe | Multi-node, 6 nodes x 8 cores | Single node, 64 cores |
| Job runner | `sbatch` / `srun` (SLURM) | `mpirun` langsung |

### Login via SSH

Buka terminal (macOS/Linux) atau MobaXterm (Windows), lalu:

```bash
# Login ke Cluster
ssh user04@152.118.31.24 -p 22

# Login ke Multicore
ssh user04@152.118.31.61 -p 22
```

Setelah login, masuk ke working directory:

```bash
cd pangeran_bercuda_mpi    # folder repo kita
ls                          # lihat isi folder
```

### Kompilasi Program MPI

```bash
# Kompilasi satu file
mpicc -O2 program.c -o program

# Kompilasi dengan math library (untuk Jacobi)
mpicc -O2 4-jacobi.c -o 4-jacobi -lm

# Kompilasi semua (pakai Makefile)
make
```

### Menjalankan di Multicore (Langsung)

Di multicore, langsung pakai `mpirun`:

```bash
# Jalankan dengan 4 proses
mpirun -np 4 ./1-hello_mpi

# Jalankan matrix multiplication dengan N=1024 dan 8 proses
mpirun -np 8 ./2-matmat 1024

# Jalankan Jacobi dengan N=512 dan 16 proses
mpirun -np 16 ./4-jacobi 512
```

### Menjalankan di Cluster (via SLURM)

Di cluster, harus submit job lewat SLURM:

**Cek status nodes dulu:**
```bash
sinfo-1
```
Output contoh:
```
PARTITION AVAIL  NODES  STATE NODELIST
batch*       up      2  down* node-[02,05]
batch*       up      4  alloc node-[01,03,06-07]
batch*       up      1   idle node-08
```
- `idle` = bisa dipakai
- `alloc` = sedang dipakai
- `down` = mati, jangan pakai

**Submit job dengan sbatch:**

Buat file script, misal `run.sh`:
```bash
#!/bin/bash
#SBATCH -J nama_job
#SBATCH -n 8

srun --mpi=pmix -n 8 /home/user04/pangeran_bercuda_mpi/1-hello_mpi
```

Lalu submit:
```bash
sbatch run.sh
```

**Cek antrian job:**
```bash
squeue-1            # lihat semua job
squeue-1 -u user04  # lihat job kita saja
```

**Cancel job:**
```bash
scancel <JOB_ID>
```

**Lihat output:**
Job SLURM menyimpan output di file `slurm-<JOB_ID>.out` secara default.

### Perintah SLURM yang Penting

| Perintah | Fungsi |
|---|---|
| `sinfo-1` | Lihat status nodes (idle/alloc/down) |
| `squeue-1` | Lihat antrian job |
| `sbatch script.sh` | Submit job |
| `scancel JOB_ID` | Cancel job |
| `sacct -j JOB_ID` | Lihat detail job yang sudah selesai |

### Tips untuk Praktik UTS

- **Buat folder UTS dulu** setelah login: `mkdir UTS-NamaAnda && cd UTS-NamaAnda`
- Kalau diminta compile dan run, **multicore lebih gampang** (langsung `mpirun`, ga perlu sbatch)
- Kalau cluster nodes penuh, jangan panik - kerja di multicore dulu
- **Rekam layar** dari awal login sampai selesai (pakai OBS atau screen recorder bawaan)
- Pastikan camera ON selama ujian

---

## Soal UTS Tahun Lalu (2025)

Berikut 76 soal pilihan ganda UTS Pemrograman Paralel tahun 2025, sudah diverifikasi jawabannya. Fokus ke soal-soal yang tricky - sisanya straightforward.

### Soal 1-10: Pengantar HPC

**1.** HPC adalah praktek agregasi pemakaian kekuatan komputasi yang memberikan kinerja lebih tinggi untuk mengatasi persoalan...
- **Jawaban: b. Sains, engineering, bisnis yang besar** - HPC digunakan untuk tiga domain utama ini. Kata kunci "besar" membedakan dari opsi c yang tanpa "besar".

**2.** Aplikasi superkomputer terkait persoalan yang terlalu ___ untuk komputer standard, membutuhkan waktu yang ___
- **Jawaban: d. Besar, sangat lama** - superkomputer menangani masalah yang terlalu besar dan butuh waktu sangat lama kalau pakai komputer biasa.

**3.** Desktop mempunyai chip pemroses ___, HPC adalah jaringan node memuat ___ chip pemroses
- **Jawaban: d. tunggal, satu atau lebih** - desktop punya satu chip, sedangkan setiap node HPC bisa punya satu atau lebih chip (multiprocessor).

**4.** Resource hungry application memecahkan masalah memakai...
- **Jawaban: b. pemodelan komputer, simulasi dan analisis** - perhatikan harus ada TIGA komponen lengkap: pemodelan, simulasi, DAN analisis. Opsi a cuma dua (pemodelan dan simulasi tanpa analisis), jadi kurang lengkap.

**5.** Resource hungry application antara lain dalam bidang...
- **Jawaban: b. semuanya benar** - resource hungry apps mencakup SEMUA bidang yang disebutkan: internet dan e-commerce, digital biology, military, CAD/CAM, life sciences, dan aerospace. Tidak ada yang tidak termasuk.

**6.** Dalam industri perminyakan, HPC digunakan untuk mencari...
- **Jawaban: a. Sumber minyak baru** - perusahaan seperti Eni dan BP pakai HPC untuk simulasi reservoir dan eksplorasi sumber minyak baru.

**7.** HPC berperan dalam mengatasi wabah ___ (43 consortium, 165K nodes, 87 projects, 6.8M CPU cores, 50K GPU, 600 PFlops)
- **Jawaban: d. covid19** - angka-angka ini merujuk ke COVID-19 HPC Consortium yang dibentuk tahun 2020.

**8.** Contoh proses paralel dalam pembangunan tembok melibatkan proses...
- **Jawaban: d. benar semua** - dalam analogi tembok, SEMUA tahap bisa diparalelkan: pembuatan batu bata bisa dilakukan banyak pabrik sekaligus, pengiriman bisa pakai banyak truk, dan penyusunan bisa dilakukan banyak pekerja di bagian tembok yang berbeda.

**9.** Proses parallel dalam pembangunan tembok juga pada proses...
- **Jawaban: d. semuanya benar** - soal ini mengulangi konsep yang sama dari no 8 dengan framing berbeda, tapi jawabannya tetap sama karena ketiga tahap (pembuatan, pengiriman, penyusunan) bisa berjalan paralel secara independen.

**10.** Pengelompokan bidang terkait HPC terdiri dari...
- **Jawaban: a. Benar semua** - empat bidang HPC: information simulation (compute), repository (storage), integration (system of systems), access (communication).

### Soal 11-20: Arsitektur dan Pemrograman Paralel

**11.** Pada arsitektur cluster, terdapat ___ satu berfungsi sebagai ___ sisanya sebagai ___ dihubungkan dengan ___
- **Jawaban: d. beberapa nodes, master, pemroses, network/switch** - cluster terdiri dari beberapa nodes, satu jadi master (head node), sisanya worker/pemroses, terhubung via network/switch.

**12.** Tujuan komputasi kinerja tinggi (HPC) adalah...
- **Jawaban: a. Semuanya benar** - tujuan HPC mencakup tiga hal sekaligus: memaksimalkan performa, meminimalkan waktu penyelesaian masalah spesifik, dan memaksimalkan jumlah masalah besar yang bisa diselesaikan dalam waktu singkat.

**13.** Peningkatan kinerja superkomputer karena faktor...
- **Jawaban: c. Benar semua** - peningkatan kinerja datang dari kombinasi tiga faktor: banyak prosesor menangani program bersamaan, pengurangan waktu per instruksi (clock cycle lebih cepat), dan pipelining/eksekusi instruksi secara paralel di level hardware.

**14.** Yang TIDAK termasuk taksonomi arsitektur komputer adalah...
- **Jawaban: a.** SIMD dengan eksekusi "secara berurutan" - ***ini TRAP!*** Deskripsi SIMD-nya salah karena bilang "berurutan" padahal SIMD mengeksekusi secara BERSAMAAN pada data yang berbeda. Makanya ini "tidak termasuk" karena deskripsinya keliru.

**15.** Yang BUKAN termasuk pemrograman shared memory adalah...
- **Jawaban: b. Syncronus Execution** - fitur shared memory programming yang benar adalah: threads of control, global shared address space, local private address space, dan parallel operations. Synchronous execution justru BUKAN fiturnya karena shared memory menggunakan eksekusi asynchronous antar thread.

**16.** Dalam pemrograman shared memory, THREADS...
- **Jawaban: b. Betul semua** - semua pernyataan benar: thread bisa di-fork untuk menjalankan prosedur tertentu, digunakan untuk membagi program jadi tugas terpisah yang berjalan bersamaan, dan bisa dialokasikan prioritas berbeda untuk mengatur pembagian waktu CPU.

**17.** Dalam pemrograman shared memory, THREADS...
- **Jawaban: a. Betul semua** - soal ini sama persis dengan no 16 tapi urutan opsinya berbeda, dan jawabannya tetap semua pernyataan tentang threads itu benar.

**18.** Dalam pemrograman parallel menggunakan thread, yang TIDAK benar adalah...
- **Jawaban: a. Semuanya salah** - ***TRICKY!*** Ini berarti TIDAK ADA pernyataan yang salah. Semua opsi b/c/d benar (threads ke prosesor berbeda = speedup, ada overhead sinkronisasi). "Semuanya salah" = tidak ada jawaban yang tidak benar.

**19.** Thread scheduling untuk menentukan alokasi threads ke prosesor...
- **Jawaban: c. Semuanya benar** - ada tiga metode scheduling thread: statis (pembagian tetap saat kompilasi), dinamis (pembagian saat runtime berdasarkan beban), dan runtime (ditentukan oleh environment variable saat eksekusi). Ketiganya valid dan digunakan di OpenMP.

**20.** Yang TIDAK termasuk data parallel adalah...
- **Jawaban: c. salah semua** - semua opsi yang disebutkan (operasi bersyarat WHERE, operasi larik A=B+C, operasi pengurangan SUM) semuanya TERMASUK dalam data parallel programming. Jadi tidak ada yang "tidak termasuk", makanya jawabannya "salah semua".

### Soal 21-30: Evaluasi Performa dan Cluster

**21.** Evaluasi performa sistem komputer dapat dilakukan dengan...
- **Jawaban: c. Benar semua** - evaluasi performa bisa dilakukan dengan berbagai cara sekaligus: benchmarking (menjalankan program standar untuk mengukur performa), evaluasi CPU secara langsung, dan menggunakan metrik MIPS (Million Instructions Per Second) serta MFLOPS (Million Floating-point Operations Per Second).

**22.** Yang TIDAK termasuk bidang information access (communication demands) adalah...
- **Jawaban: d. Image processing** - information access itu bidang yang didominasi oleh kebutuhan komunikasi/transfer data, seperti text on demand, imagery on demand, dan online transactions. Image processing justru termasuk information simulation yang didominasi komputasi, bukan komunikasi.

**23.** Yang TIDAK benar dari pernyataan berikut...
- **Jawaban: a.** Pernyataan "dalam evaluasi MFLOPS, semua operasi floating point dianggap sama" itu SALAH karena kenyataannya operasi floating point punya kompleksitas berbeda-beda (misalnya pembagian lebih lambat dari penjumlahan), sehingga tidak bisa dianggap sama bobotnya.

**24.** Yang TIDAK termasuk information simulation (compute dominated) adalah...
- **Jawaban: c. Seismic data analysis** - information simulation mencakup masalah yang didominasi komputasi seperti molecular dynamics, electromagnetic simulation, dan structural dynamics. Seismic data analysis lebih ke information repository (storage dominated) karena fokusnya pada penyimpanan dan pengolahan data seismik yang besar.

**25.** Cara meningkatkan kinerja komputer...
- **Jawaban: b. semuanya benar** - ada tiga pendekatan untuk meningkatkan kinerja: memakai hardware yang lebih cepat (prosesor, memori), mengoptimumkan algoritma dan teknik pemecahan masalah, serta memakai beberapa komputer secara bersamaan (komputasi paralel).

**26.** Hambatan kecepatan prosesor...
- **Jawaban: d. benar semua** - ada tiga hambatan fundamental dalam meningkatkan kecepatan prosesor tunggal: keterbatasan kecepatan cahaya (sinyal tidak bisa lebih cepat dari cahaya), hukum termodinamika (panas yang dihasilkan makin tinggi), dan biaya produksi prosesor yang sangat mahal untuk fabrikasi chip yang lebih canggih.

**27.** Sistem klaster adalah sistem pemrosesan ___ yang terdiri dari ___ komputer, bekerja seperti sumber daya yang ___
- **Jawaban: a. parallel, kumpulan, terintegrasi** - definisi cluster: pemrosesan paralel/terdistribusi, kumpulan komputer, bekerja terintegrasi sebagai satu kesatuan.

**28.** Suatu node dalam sistem klaster...
- **Jawaban: d. suatu system berprosesor tunggal atau banyak dengan memory, fasilitas I/O dan OS** - node = unit dasar cluster, bisa single atau multiprocessor, punya memory, I/O, dan OS sendiri.

**29.** Yang termasuk bagian arsitektur sistem cluster...
- **Jawaban: b. benar semua** - arsitektur cluster terdiri dari interconnect, network interface, middleware, programming env, applications, dan software komunikasi.

**30.** Yang BUKAN perkakas pemrograman parallel...
- **Jawaban: c. MPI, PVM dan LaTex** - MPI dan PVM memang tools pemrograman paralel, tapi LaTeX adalah sistem typesetting untuk membuat dokumen, bukan untuk pemrograman paralel. Kehadiran LaTeX di opsi ini yang membuatnya jadi jawaban "bukan".

### Soal 31-40: True/False

**31.** Tujuan HPC adalah maximize performance - **True** - salah satu tujuan utama HPC memang memaksimalkan performa komputasi.

**32.** Cara memaksimalkan kinerja: menambah waktu per instruksi - **False** - menambah waktu per instruksi justru memperlambat, yang benar adalah mengurangi waktu per instruksi.

**33.** Taksonomi termasuk SISD - **True** - SISD (Single Instruction Single Data) adalah salah satu dari 4 kategori taksonomi Flynn.

**34.** SIMD: SEBAGIAN prosesor mengeksekusi secara berurutan - **False** - SIMD mengeksekusi di SEMUA prosesor secara BERSAMAAN, bukan sebagian dan bukan berurutan.

**35.** Sama seperti 34 - **False** - alasan sama: SIMD = semua prosesor, bersamaan.

**36.** Message passing menargetkan MIMD dengan distributed memory - **True** - MPI adalah contoh message passing yang dirancang untuk arsitektur MIMD dengan memori terdistribusi.

**37.** Threads of Control termasuk fitur shared memory - **True** - thread adalah mekanisme utama paralelisme di model shared memory (fork-join).

**38.** Data parallel programming memproses data secara paralel pada beberapa komputer - **True** - data parallel = operasi yang sama diterapkan ke banyak elemen data secara bersamaan.

**39.** Distribusi data dan komunikasi ditangani compiler tanpa bimbingan programmer - **True** - dalam data parallel (contoh HPF), compiler yang menangani distribusi dan komunikasi secara otomatis.

**40.** Contoh data parallel languages adalah HPF - **True** - High Performance Fortran (HPF) adalah bahasa data parallel yang paling terkenal.

### Soal 41-50: Aplikasi Cluster

**41.** Cluster di industri manufaktur untuk...
- **Jawaban: d. Memodelkan dan mensimulasikan produk sebelum produksi fisik** - di industri manufaktur, cluster digunakan untuk simulasi CAD/CAE sehingga produk bisa diuji secara virtual (stress test, aerodinamika, thermal) sebelum membuat prototipe fisik yang mahal.

**42.** Cluster di industri keuangan/perbankan untuk...
- **Jawaban: a. Analisis risiko dan prediksi pasar** - bank dan institusi keuangan memanfaatkan cluster untuk menjalankan model risiko yang kompleks, simulasi Monte Carlo untuk pricing derivatif, dan prediksi pergerakan pasar yang membutuhkan komputasi besar.

**43.** Cluster di industri hiburan/desain untuk...
- **Jawaban: b. Merender grafis 3D kompleks dan animasi** - studio film seperti Pixar dan game studio menggunakan render farm (cluster) untuk merender frame-frame animasi 3D secara paralel, karena satu frame bisa memakan waktu berjam-jam kalau pakai satu komputer.

**44.** Pemantauan adalah aspek penting manajemen cluster - **True** - monitoring tools digunakan untuk mengawasi kinerja dan kesehatan setiap node.

**45.** Apa yang dimaksud "pemulihan bencana" dalam cluster computing?
- **Jawaban: c. Kemampuan menjalankan tugas dari node yang berbeda** - dalam konteks cluster, disaster recovery berarti node lain bisa mengambil alih tugas jika satu node gagal (fail-over).

**46.** Pertimbangan penting merancang cluster...
- **Jawaban: c. Efisiensi energi dan manajemen daya** - cluster besar konsumsi listrik tinggi, jadi efisiensi energi jadi pertimbangan desain utama.

**47.** Peran manajer cluster...
- **Jawaban: d. Mengatur distribusi tugas antara node-node** - cluster manager (seperti SLURM) bertanggung jawab menjadwalkan dan mendistribusikan job ke nodes.

**48.** Jenis cluster untuk daya komputasi tinggi dalam waktu singkat...
- **Jawaban: a. Cluster High-Performance (HPC)** - HPC cluster dirancang khusus untuk komputasi intensif dengan performa maksimal.

**49.** Tujuan utama cluster computing...
- **Jawaban: a. Meningkatkan ketersediaan dan kinerja sistem** - dua tujuan utama: high availability (kalau node mati, sistem tetap jalan) dan high performance.

**50.** Langkah instalasi NFS: instalasi server, instalasi client, buat dir mirror, konfigurasi exports, konfigurasi fstab - **True** - urutan ini benar untuk setup NFS (Network File System) di cluster.

### Soal 51-60: SLURM dan Lanjutan

**51.** Cluster HPC dirancang untuk daya komputasi tinggi dalam waktu lama - **False** - HPC cluster untuk waktu SINGKAT, bukan lama. Tujuannya menyelesaikan komputasi besar secepat mungkin.

**52.** Singkatan SLURM...
- **Jawaban: d. Simple Linux Utility for Resource Management** - SLURM adalah cluster manager open source yang paling banyak dipakai.

**53.** Keuntungan cluster untuk bioinformatika...
- **Jawaban: d. Kemampuan analisis data kompleks** - bioinformatika butuh analisis data genomik yang sangat besar dan kompleks (DNA sequencing, protein folding).

**54.** Cluster load balancing membagi beban kerja dengan adil - **True** - load balancing cluster mendistribusikan request/job secara merata ke semua node.

**55.** Manajemen pengguna dalam sistem cluster...
- **Jawaban: d. Pembuatan, penghapusan, dan pengaturan akun pengguna** - user management di cluster mencakup CRUD akun dan pengaturan akses/kuota.

**56.** Flynn's taxonomy adalah...
- **Jawaban: c. klasifikasi arsitektur komputasi** - Flynn membagi arsitektur jadi 4: SISD, SIMD, MISD, MIMD berdasarkan aliran instruksi dan data.

**57.** Minimum memori front node Rocks cluster...
- **Jawaban: b. 1 GB** - Rocks cluster distribution membutuhkan minimal 1 GB RAM untuk front/head node.

**58.** "Rolls" dalam Rocks cluster...
- **Jawaban: c. Paket perangkat lunak yang telah dikonfigurasi sebelumnya** - Rolls = bundled software packages yang tinggal diinstal ke cluster Rocks.

**59.** Tugas manajer cluster: penjadwalan, alokasi resource, monitoring, manajemen - **True** - empat tugas utama cluster manager sesuai definisi.

**60.** Cluster untuk komputasi kuantum...
- **Jawaban: d. Mengelola dan mengendalikan kubus kuantum yang terhubung** - cluster computing digunakan untuk mengontrol dan mengelola qubit-qubit dalam sistem quantum.

### Soal 61-70: Pemrograman MPI

**61.** Kode MPI_Scatter dengan sendbuf = {1,2,3,4}. Apa yang dilakukan?
- **Jawaban: a. Mengirim nilai 1, 2, 3, dan 4 dari proses master ke setiap proses** - MPI_Scatter membagi array sendbuf yang ada di root (rank 0) menjadi potongan-potongan berukuran sama, lalu mengirimkan satu potongan ke masing-masing proses. Dengan 4 elemen dan 4 proses, setiap proses dapat tepat 1 elemen.

**62.** Kode MPI_Scatter. Berapa nilai yang dicetak proses rank 2?
- **Jawaban: c. 3** - MPI_Scatter mendistribusikan elemen secara berurutan berdasarkan rank: rank 0 dapat sendbuf[0]=1, rank 1 dapat sendbuf[1]=2, rank 2 dapat sendbuf[2]=3, rank 3 dapat sendbuf[3]=4. Jadi rank 2 menerima dan mencetak nilai 3.

**63.** Fungsi MPI_Gather...
- **Jawaban: b. Mengumpulkan data dari semua proses ke proses master** - MPI_Gather adalah kebalikan dari MPI_Scatter: setiap proses mengirimkan datanya ke root process, dan root menyusun semua data tersebut ke dalam satu array recvbuf secara berurutan berdasarkan rank.

**64.** Fungsi MPI_Bcast...
- **Jawaban: b. Mengirim data dari proses master ke semua proses lainnya** - MPI_Bcast (broadcast) mengirim data yang SAMA dari root ke semua proses lain. Bedakan dengan Scatter yang MEMECAH data sehingga setiap proses dapat bagian yang BERBEDA.

**65.** Fungsi MPI_Scatter...
- **Jawaban: c. Memecah data dan mengirimkan potongan ke setiap proses** - MPI_Scatter mengambil array di root process, memecahnya menjadi potongan-potongan berukuran sama, lalu mendistribusikan setiap potongan ke proses yang berbeda berdasarkan urutan rank.

**66.** MPI dalam pemrograman paralel...
- **Jawaban: b. Message Passing Interface** - MPI adalah standar/spesifikasi internasional untuk komunikasi antar proses di sistem distributed memory, diimplementasikan oleh library seperti OpenMPI dan MPICH.

**67.** Fungsi MPI_Comm_rank...
- **Jawaban: Mendapatkan rank dari proses saat ini** - MPI_Comm_rank mengembalikan rank (ID unik) dari proses yang memanggilnya dalam communicator tertentu, nilainya dari 0 sampai size-1.

**68.** Berapa total proses yang dijalankan program MPI?
- **Jawaban: a. Tergantung pada jumlah argumen saat menjalankan program** - jumlah proses MPI tidak ditentukan di dalam kode program, melainkan ditentukan saat runtime melalui perintah `mpirun -np N` atau `mpiexec -n N`, di mana N adalah jumlah proses yang diinginkan.

**69.** Kode MPI_Bcast dengan data=10. Apa yang dilakukan?
- **Jawaban: a. Mengirim nilai 10 dari proses master ke semua proses** - rank 0 menginisialisasi data=10, kemudian MPI_Bcast menyiarkan nilai tersebut ke semua proses lainnya sehingga setelah Bcast, semua proses punya data=10.

**70.** Kode MPI_Bcast dengan data=5. Nilai yang dicetak semua proses?
- **Jawaban: a. 5** - karena MPI_Bcast menyiarkan nilai yang SAMA dari root ke semua proses, setelah Bcast selesai semua proses (termasuk root sendiri) punya data=5 dan mencetak angka 5.

### Soal 71-76: MPI Lanjutan

**71.** Potongan kode mengirim data menggunakan MPI. Apa yang dilakukan?
- **Jawaban: a. Mengirim data dari proses rank 0 ke proses rank 1** - ini adalah pattern point-to-point communication paling dasar di MPI: rank 0 memanggil MPI_Send untuk mengirim data, dan rank 1 memanggil MPI_Recv untuk menerima data tersebut.

**72.** Fungsi MPI_Reduce...
- **Jawaban: c. Menggabungkan data dari semua proses dan menjalankan operasi reduksi** - MPI_Reduce mengambil data dari SEMUA proses, mengaplikasikan operasi tertentu (seperti SUM, MAX, MIN, PROD), dan menyimpan hasilnya HANYA di root process. Ini berbeda dari Gather yang hanya mengumpulkan tanpa operasi.

**73.** Kode MPI_Reduce dengan MPI_SUM, sendbuf = rank+1. Apa yang dilakukan?
- **Jawaban: c. Menghitung jumlah semua nilai dan menampilkan hasilnya di proses master** - setiap proses mengirim sendbuf = rank+1 (proses 0 kirim 1, proses 1 kirim 2, dst), lalu MPI_Reduce dengan operasi MPI_SUM menjumlahkan semua nilai tersebut dan hasilnya disimpan di recvbuf pada root (rank 0).

**74.** Kode MPI_Gather, sendbuf = rank+1. Nilai yang dicetak proses rank 2 di master?
- **Jawaban: b. 3** - setiap proses mengirim sendbuf = rank+1, jadi rank 2 mengirim nilai 2+1 = 3. MPI_Gather mengumpulkan semua nilai ke root process, di mana recvbuf[2] berisi nilai dari rank 2, yaitu 3.

**75.** Kode MPI_Reduce MPI_SUM, sendbuf = rank+1, 4 proses. Hasil?
- **Jawaban: a. 10** - dengan 4 proses, masing-masing mengirim rank+1: proses 0 kirim 1, proses 1 kirim 2, proses 2 kirim 3, proses 3 kirim 4. MPI_SUM menjumlahkan semuanya: 1+2+3+4 = 10.

**76.** Kode MPI_Gather, sendbuf = rank+1. Apa yang dilakukan?
- **Jawaban: b. Mengumpulkan nilai dari setiap proses dan menampilkannya di proses master** - MPI_Gather mengumpulkan sendbuf dari setiap proses ke array recvbuf di root process, kemudian root (rank 0) melakukan loop untuk mencetak recvbuf[i] untuk setiap proses i.

### Pola Soal yang Sering Muncul

- **"Semuanya benar/salah"** - hati-hati dengan soal yang punya opsi ini. Cek SEMUA opsi lain dulu sebelum pilih.
- **Soal negatif** ("yang TIDAK termasuk", "yang BUKAN") - baca pelan-pelan, jangan terbalik logikanya.
- **SIMD trap** - deskripsi SIMD sering dimodifikasi (berurutan vs bersamaan). Ingat: SIMD = SEMUA prosesor eksekusi instruksi yang SAMA secara BERSAMAAN.
- **Bcast vs Scatter** - Bcast kirim data SAMA ke semua. Scatter PECAH data berbeda ke tiap proses.
- **MPI_Reduce** - dengan 4 proses dan sendbuf = rank+1, hasilnya SUM = 1+2+3+4 = 10.
- **MPI_Scatter** - rank N menerima sendbuf[N]. Rank 2 = sendbuf[2].
