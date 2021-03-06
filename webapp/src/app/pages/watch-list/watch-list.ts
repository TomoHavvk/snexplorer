import {Component, NgModule, ViewChild, AfterViewInit, OnDestroy, OnInit} from '@angular/core';
import {GuideItems} from '../../shared/guide-items/guide-items';
import {MatListModule, MatTableDataSource} from '@angular/material';
import {MatFormFieldModule} from '@angular/material';
import {MatInputModule} from '@angular/material';
import {MatSelectModule} from '@angular/material';
import {MatCheckboxModule} from '@angular/material';
import {MatAutocompleteModule} from '@angular/material';
import {RouterModule} from '@angular/router';
import {MatGridListModule} from '@angular/material';
import {MatCardModule} from '@angular/material';
import {FooterModule} from '../../shared/footer/footer';
import {CommonModule} from '@angular/common';
import {MatExpansionModule} from '@angular/material/expansion';
import {ComponentPageTitle} from '../page-title/page-title';
import {CookieService} from 'ngx-cookie';

import {HttpClient} from '@angular/common/http';
import {
  MatPaginator,
  MatProgressSpinnerModule,
  MatSort,
  MatSortModule,
  MatTableModule,
  MatPaginatorModule
} from '@angular/material';
import {merge, interval, Observable, of as observableOf, Subscription, BehaviorSubject} from 'rxjs';
import {catchError, map, startWith, switchMap} from 'rxjs/operators';
import {ReactiveFormsModule, FormControl, FormsModule} from '@angular/forms';
import {Meta} from "@angular/platform-browser";

@Component({
  selector: 'app-watchlist',
  templateUrl: './watch-list.html',
  styleUrls: ['./watch-list.scss']
})


export class WatchList implements AfterViewInit, OnDestroy, OnInit {
  private subscription: Subscription;
  displayedColumns: string[];
  database: HttpDatabase | null;
  dataSource = null;
  height = 0;
  data: Node[] = [];
  isLoadingResults = true;
  options: string[] = [];
  myControl = new FormControl();
  searchInput: string = '';
  isMobile: boolean;
  panelOpenState = false;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(private meta: Meta, public componentPageTitle: ComponentPageTitle, private http: HttpClient, private cookieService: CookieService) {
    this.meta.updateTag({ name: 'description', content: 'Graft Network Supernodes watchlist.' });
    this.componentPageTitle.title = `Watchlist`;
  }

  ngOnInit() {

    this.isMobile = /Android|iPhone/i.test(window.navigator.userAgent);
    if (this.isMobile) {
      this.displayedColumns = ['PublicId', 'IsOnline', 'StakeAmount', 'ExpirationTime', 'watchlist'];
    } else {
      this.displayedColumns = ['BlockchainBasedListTier', 'PublicId', 'Address', 'IsOnline', 'StakeAmount', 'StakeExpiringBlock', 'LastUpdateAge', 'ExpirationTime', 'watchlist'];
    }
    console.log("isMobile - " + this.isMobile)
  }

  ngAfterViewInit() {
    this.isLoadingResults = true;

    this.loadData();

    merge(this.sort.sortChange).subscribe(data => {
      this.dataSource.sort = this.sort;
    });

    this.autoRefresh()
  }

  ngOnDestroy() {
    this.subscription.unsubscribe()
  }

  loadData() {
    this.database = new HttpDatabase(this.http);
    merge()
      .pipe(
        startWith({}),
        switchMap(() => {

          return this.database!.getRepoIssues(
            this.sort.active, this.sort.direction);
        }),
        map(data => {
          this.isLoadingResults = false;
          this.height = data.height
          return data.nodes;
        }),
        catchError(() => {
          this.isLoadingResults = false;
          return observableOf([]);
        })
      ).subscribe(data => {
      this.data = data;
      this.options = this.data.map(x => x.PublicId);

      let nodes: Node[] = [];
      if (this.cookieService.get('watchlist')) {

        let watchlist: string [] = JSON.parse(this.cookieService.get('watchlist'));
        this.data.forEach(function (node) {
          if (watchlist.indexOf(node.PublicId) != -1) {
            node.favorite = true;
            nodes.push(node)
          } else if (watchlist.indexOf(node.Address) != -1) {
            node.favorite = true;
            nodes.push(node)
          }
        });


        let inp = '';
        watchlist.forEach(function (value) {
          inp = inp + value + "\n";
        });

        if (inp.trim() != '')
          this.searchInput = inp.trim() + '\n'
      }
      this.dataSource = new MatTableDataSource(nodes);
      this.dataSource.sort = this.sort;
    });
  }

   copyToClipboard(address: string) {
    const el = document.createElement('textarea');
    el.value = address;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  hideAddress(address: string): string {
    return address.substring(0, 5) + "..."
      + address.substring(address.length - 5, address.length)
  }

  removeFromWatchlist(node: Node) {
    let watchlist: string [] = JSON.parse(this.cookieService.get('watchlist'));
    watchlist = watchlist.filter(x => x !== node.PublicId);
    node.favorite = false;
    this.dataSource.data = this.dataSource.data.filter(x => node.PublicId != x.PublicId)
    this.cookieService.put('watchlist', JSON.stringify(watchlist));
    if (watchlist.length == 0) {
      this.searchInput = ''
    }
  }

  addToWatchlist(publicId: string) {
    let nodes: Node[] = []
    if (this.cookieService.get('watchlist')) {
      let watchlist: string [] = JSON.parse(this.cookieService.get('watchlist'));
      if (watchlist.filter(x => x == publicId).length > 0) {
        this.myControl.setValue('');
        return;
      }
      this.data.forEach(node => {
        if (publicId === node.PublicId) {
          watchlist.push(node.PublicId);
          this.cookieService.put('watchlist', JSON.stringify(watchlist));
          node.favorite = true
          nodes.push(node)
        }
      });
    } else {
      this.data.forEach(node => {
        if (publicId === node.PublicId) {
          let watchlist: string [] = [node.PublicId];
          this.cookieService.put('watchlist', JSON.stringify(watchlist));
          node.favorite = true
          nodes.push(node)
        }
      });
    }
    nodes = nodes.concat(this.dataSource.data);
    this.dataSource = new MatTableDataSource(nodes);
    this.myControl.setValue('');
  }

  private _filter(value: string): string[] {

    const filterValue = value.toLowerCase();
    return this.options.filter(option => option.toLowerCase().includes(filterValue));
  }

  autoRefresh() {
    const source = interval(120000);
    this.subscription = source.subscribe(val => {
      this.loadData()
    });
  }

  watch() {
    if (this.searchInput.trim() != '') {

      let watchlist: string [] = [];
      if (this.cookieService.get('watchlist')) watchlist = JSON.parse(this.cookieService.get('watchlist'));

      let input = this.searchInput.split('\n');
      input.forEach(function (value) {
        if (watchlist.indexOf(value) == -1) {
          watchlist.push(value)
        }
      });
      let valuesToRemove = []
      watchlist.forEach(function (value) {
        if (input.indexOf(value) == -1) {
          valuesToRemove.push(value)
        }
      });
      valuesToRemove.forEach(function (value) {
        watchlist.splice(watchlist.indexOf(value), 1);
      });

      this.cookieService.put('watchlist', JSON.stringify(watchlist));
      this.searchInput = this.searchInput + '\n';
    } else {
      this.cookieService.put('watchlist', JSON.stringify([]));
      this.searchInput = this.searchInput.trim()
    }
    this.loadData()
  }
}

export interface Supernodes {
  nodes: Node[];
  height: number;
}

export interface Node {
  Address: string;
  PublicId: string;
  StakeAmount: string;
  StakeFirstValidBlock: string;
  StakeExpiringBlock: string;
  IsStakeValid: string;
  BlockchainBasedListTier: string;
  AuthSampleBlockchainBasedListTier: string;
  IsAvailableForAuthSample: string;
  LastUpdateAge: string;
  ExpirationTime: string;
  IsOnline: string;
  favorite: boolean;
}

export class HttpDatabase {
  constructor(private http: HttpClient) {
  }

  getRepoIssues(sort: string, order: string): Observable<Supernodes> {
    const href = '/api/v1/supernode/list';

    return this.http.get<Supernodes>(href);
  }
}

@NgModule({
  imports: [MatListModule, MatExpansionModule, FormsModule, MatCardModule, MatAutocompleteModule, ReactiveFormsModule, MatSelectModule, MatCheckboxModule, MatGridListModule, MatInputModule, MatFormFieldModule, MatSortModule, MatProgressSpinnerModule, MatTableModule, MatPaginatorModule, RouterModule, FooterModule, CommonModule],
  exports: [WatchList],
  declarations: [WatchList],
  providers: [GuideItems, ComponentPageTitle],
})
export class WatchListModule {
}
